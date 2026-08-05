import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import {
  FinalBriefSchema,
  formatZodError,
  getSchemaForIntent,
  schemaHintForIntent,
} from './schemas.ts'
import { INTERVIEWER_PROMPT } from './prompts/interviewer.ts'
import { DIAGNOSTICIAN_PROMPT } from './prompts/diagnostician.ts'

// Global provided by the Supabase/Deno-Deploy edge runtime for background
// work that must survive after the Response is returned. The isolate can be
// torn down as soon as the response is sent, which can silently drop a bare
// non-awaited promise — waitUntil is the supported fire-and-forget mechanism
// for this runtime specifically. Do not replace with `void somePromise`.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RATE_LIMIT = 20
const RATE_WINDOW_MINUTES = 5
const SIGNED_URL_TTL_SECONDS = 3600
const COST_CAP_USD = 0.45
const LOW_CONFIDENCE_THRESHOLD = 0.6
const PER_CAUSE_CLAMP = 55
const ANTHROPIC_MAX_TOKENS = 4096
// Anthropic defaults to temperature 1.0 when unset — highest-variance
// sampling. These intents need run-to-run consistency (same intake answers
// should not swing between "immediate, $100-600" and "monitor, $600-1250"),
// so we pin it explicitly instead of relying on the API default.
const DIAGNOSTICIAN_TEMPERATURE = 0.2
const INTERVIEWER_TEMPERATURE = 0.3

function temperatureForIntent(intent: Intent): number {
  return intent === 'interviewer' ? INTERVIEWER_TEMPERATURE : DIAGNOSTICIAN_TEMPERATURE
}

type Intent =
  | 'interviewer'
  | 'diagnostician_hypothesis'
  | 'diagnostician_final'
  | 'get_intake'
  | 'signed_url'

type Provider = 'anthropic' | 'openai'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const openaiKey = Deno.env.get('OPENAI_API_KEY')

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const body = await req.json()
    const intent = body.intent as Intent
    const intakeId = body.intake_id as string | undefined
    const payload = body.payload ?? {}

    if (!intent) {
      return jsonError(400, 'missing_intent', 'intent is required')
    }

    const { data: userData } = await userClient.auth.getUser()
    const userId = userData.user?.id ?? null

    if (intent === 'get_intake') {
      if (!intakeId) return jsonError(400, 'missing_intake_id', 'intake_id is required')
      const allowed = await canAccessIntake(admin, intakeId, userId)
      if (!allowed) return jsonError(403, 'forbidden', 'Not authorized to read this intake')
      const data = await fetchIntakeBundle(admin, intakeId)
      return jsonOk(data)
    }

    if (intent === 'signed_url') {
      if (!intakeId) return jsonError(400, 'missing_intake_id', 'intake_id is required')
      const storagePath = payload.storage_path as string
      if (!storagePath) return jsonError(400, 'missing_storage_path', 'storage_path is required')
      const allowed = await canAccessIntake(admin, intakeId, userId)
      if (!allowed) return jsonError(403, 'forbidden', 'Not authorized')
      if (!storagePath.startsWith(`${intakeId}/`)) {
        return jsonError(403, 'forbidden', 'storage_path does not match intake')
      }
      const { data, error } = await admin.storage
        .from('intake-media')
        .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)
      if (error) return jsonError(500, 'signed_url_failed', error.message)
      return jsonOk({ signed_url: data.signedUrl, expires_in: SIGNED_URL_TTL_SECONDS })
    }

    if (intent === 'diagnostician_final' && payload.stub_brief) {
      const allowed = await canCallLlm(admin, intakeId, userId)
      if (!allowed) return jsonError(403, 'forbidden', 'Intake session expired or not accessible')

      const stubResult = FinalBriefSchema.safeParse(payload.stub_brief)
      if (!stubResult.success) {
        return jsonError(422, 'validation_failed', formatZodError(stubResult.error))
      }

      // Fetch the bundle even in stub mode so the safety-urgency validator
      // is truly non-bypassable — a client-side stub brief could otherwise
      // under-rate urgency with no server check at all.
      const bundle = await fetchIntakeBundle(admin, intakeId)
      const conversation = bundle.messages.map((m: { role: string; content: unknown }) => ({
        role: m.role,
        content: m.content,
      }))
      const mediaSummary = buildMediaSummary(bundle.media)
      const priorConfidence = getLastHypothesisConfidence(conversation)
      const withConfidence = {
        ...stubResult.data,
        confidence: stubResult.data.confidence ?? priorConfidence ?? undefined,
      }
      const { brief, lowConfidence } = finalizeBrief(withConfidence, {
        mediaSummary,
        conversation,
      })

      // fallback_used is decided client-side (it knows whether this stub
      // run followed a real LLM failure vs. plain demo/stub mode) — the
      // edge function just persists whatever the client asserts, since this
      // is the only write path into `intakes` for a stub-mode brief.
      const fallbackUsed = Boolean(payload.fallback_used)

      const { error: updateError } = await admin
        .from('intakes')
        .update({
          brief,
          status: 'complete',
          urgency: brief.urgency,
          category: brief.category,
          low_confidence: lowConfidence,
          fallback_used: fallbackUsed,
        })
        .eq('id', intakeId)

      if (updateError) return jsonError(500, 'brief_persist_failed', updateError.message)
      return jsonOk({ result: brief })
    }

    // LLM intents
    if (!intakeId) return jsonError(400, 'missing_intake_id', 'intake_id is required')

    // Kill switch — flip DIAGNOSIS_ENGINE=stub to instantly roll back to
    // stubs with no code deploy. Reuses the client's existing
    // llm_unconfigured fallback path, so no client-side change is needed
    // for this specifically. Checked before any DB gating/spend.
    const diagnosisEngine = Deno.env.get('DIAGNOSIS_ENGINE') ?? 'llm'
    if (diagnosisEngine === 'stub') {
      return jsonError(503, 'llm_unconfigured', 'DIAGNOSIS_ENGINE=stub — client should use stubs')
    }

    const llmAllowed = await canCallLlm(admin, intakeId, userId)
    if (!llmAllowed) {
      return jsonError(403, 'forbidden', 'Intake session expired or not accessible')
    }

    const rateLimited = await isRateLimited(admin, intakeId)
    if (rateLimited) {
      return jsonError(429, 'rate_limited', `Max ${RATE_LIMIT} LLM calls per ${RATE_WINDOW_MINUTES} minutes`, {
        retry_after_seconds: 60,
      })
    }

    const { provider, apiUrl, apiKey, model } = resolveProviderConfig(intent, anthropicKey, openaiKey)

    if (!apiKey) {
      const missingVar = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'
      return jsonError(503, 'llm_unconfigured', `${missingVar} not configured`)
    }

    // Cost cap — before any bundle fetch / LLM call, so a capped intake
    // doesn't pay for a wasted round trip. costSoFar sums llm_traces for
    // this intake grouped by model_id, so mixed-provider intakes (e.g. an
    // OpenAI rollback mid-intake) are still priced correctly.
    const spent = await costSoFar(admin, intakeId)
    const projected = projectedCallCost(intent, model)
    if (spent + projected > COST_CAP_USD) {
      await admin
        .from('intakes')
        .update({ llm_cost_capped: true, llm_cost_usd: spent })
        .eq('id', intakeId)
      return jsonError(
        402,
        'cost_cap_exceeded',
        `Intake cost cap of $${COST_CAP_USD.toFixed(2)} reached ($${spent.toFixed(3)} spent).`,
        { spent, cap: COST_CAP_USD }
      )
    }

    const bundle = await fetchIntakeBundle(admin, intakeId)
    const llmPayload = {
      ...payload,
      round: payload.round ?? 1,
      vehicle: payload.vehicle ?? bundle.intake.vehicle ?? null,
      media_summary: buildMediaSummary(bundle.media),
      conversation: bundle.messages.map((m: { role: string; content: unknown }) => ({
        role: m.role,
        content: m.content,
      })),
    }

    const systemPrompt = loadPrompt(intent)
    const schema = getSchemaForIntent(intent)!
    const hint = schemaHintForIntent(intent)

    if (intent === 'diagnostician_final' && payload.stream) {
      await admin.from('llm_call_log').insert({ intake_id: intakeId })
      return streamDiagnosticianFinal(
        admin,
        intakeId!,
        provider,
        apiUrl,
        apiKey,
        model,
        systemPrompt,
        llmPayload,
        hint,
        spent
      )
    }

    const temperature = temperatureForIntent(intent)
    let call = await callLlm(provider, apiUrl, apiKey, model, systemPrompt, llmPayload, temperature)
    let result = schema.safeParse(call.parsed)

    if (!result.success) {
      call = await callLlm(
        provider,
        apiUrl,
        apiKey,
        model,
        systemPrompt,
        llmPayload,
        temperature,
        `Your response failed validation: ${formatZodError(result.error)}. Reply with valid JSON matching this schema: ${hint}`
      )
      result = schema.safeParse(call.parsed)
    }

    // responseParsed/parseErrorNote start as the raw validated result, then
    // get overwritten below by intent-specific post-processing (the
    // sound_capture/motion_capture drop for hypotheses, or the safety +
    // low-confidence guard for final briefs) — the trace insert further down
    // must see the final versions, not the pre-processing ones.
    let responseParsed: unknown = result.success ? result.data : null
    let parseErrorNote: string | null = result.success ? null : formatZodError(result.error)
    let lowConfidenceFlag = false
    let finalBriefForPersist: Record<string, unknown> | null = null

    if (result.success && intent === 'diagnostician_hypothesis') {
      // Round is always >= 1 in this schema — "round 0" in product terms is
      // the initial intake capture, which happens client-side before any
      // Diagnostician call and never reaches this branch. So this filter
      // applies unconditionally: once the interview is underway, the
      // Diagnostician can still request a photo (visible_damage) but not a
      // fresh audio/video capture.
      const hyp = result.data as { needs_more_info: string[] }
      const filtered = hyp.needs_more_info.filter((entry) => {
        const base = entry.split(':')[0]?.trim()
        return base !== 'sound_capture' && base !== 'motion_capture'
      })
      if (filtered.length !== hyp.needs_more_info.length) {
        parseErrorNote = 'intent_dropped:sound_capture_or_motion_capture'
      }
      responseParsed = { ...hyp, needs_more_info: filtered }
    }

    if (result.success && intent === 'diagnostician_final') {
      const brief = result.data as {
        urgency: string
        urgencyLabel: string
        disclaimer: string
        category: string
        confidence?: number
        probableCauses: Array<{ cause: string; confidence: number }>
        [key: string]: unknown
      }
      const priorConfidence = getLastHypothesisConfidence(llmPayload.conversation)
      const withConfidence = { ...brief, confidence: brief.confidence ?? priorConfidence ?? undefined }
      const { brief: finalized, overrideReason, lowConfidence } = finalizeBrief(withConfidence, {
        mediaSummary: llmPayload.media_summary,
        conversation: llmPayload.conversation,
      })
      responseParsed = finalized
      if (overrideReason) parseErrorNote = `safety_override:${overrideReason}`
      lowConfidenceFlag = lowConfidence
      finalBriefForPersist = finalized
    }

    const promptVersion =
      intent === 'interviewer'
        ? Deno.env.get('INTERVIEWER_PROMPT_SHA') ?? 'unknown'
        : Deno.env.get('DIAGNOSTICIAN_PROMPT_SHA') ?? 'unknown'
    const traceRole = intent === 'interviewer' ? 'interviewer' : 'diagnostician'

    const insertTrace = admin.from('llm_traces').insert({
      intake_id: intakeId,
      role: traceRole,
      round_number: llmPayload.round ?? null,
      model_id: model,
      prompt_version: promptVersion,
      prompt_input: { messages: call.requestMessages },
      response_raw: call.rawResponseBody,
      response_parsed: responseParsed,
      parse_error: parseErrorNote,
      latency_ms: call.latencyMs,
      input_tokens: call.inputTokens,
      output_tokens: call.outputTokens,
    })
    EdgeRuntime.waitUntil(
      insertTrace.then(() => {}).catch((err) => console.error('[llm_traces] insert failed', err))
    )

    if (!result.success) {
      return jsonError(422, 'validation_failed', formatZodError(result.error), {
        raw_output: call.parsed,
        schema_hint: hint,
      })
    }

    await admin.from('llm_call_log').insert({ intake_id: intakeId })

    if (intent === 'diagnostician_final' && finalBriefForPersist) {
      const thisCallCost = costForTokens(model, call.inputTokens ?? 0, call.outputTokens ?? 0)
      const { error: updateError } = await admin
        .from('intakes')
        .update({
          brief: finalBriefForPersist,
          status: 'complete',
          urgency: finalBriefForPersist.urgency,
          category: finalBriefForPersist.category,
          low_confidence: lowConfidenceFlag,
          llm_cost_usd: spent + thisCallCost,
        })
        .eq('id', intakeId)

      if (updateError) {
        return jsonError(500, 'brief_persist_failed', updateError.message)
      }
    }

    return jsonOk({ result: responseParsed })
  } catch (err) {
    console.error(err)
    return jsonError(500, 'internal_error', err instanceof Error ? err.message : 'Unknown error')
  }
})

// Prompts are inlined as generated TS modules (see scripts/sync-prompts.mjs)
// because the deploy bundler can't trace runtime Deno.readTextFile calls, so
// sidecar .md files never make it into the deployed function.
function loadPrompt(intent: string): string {
  return intent === 'interviewer' ? INTERVIEWER_PROMPT : DIAGNOSTICIAN_PROMPT
}

// ---------------------------------------------------------------------------
// Provider abstraction (Anthropic Claude, with OpenAI kept for rollback)
// ---------------------------------------------------------------------------

function resolveProviderConfig(
  intent: Intent,
  anthropicKey: string | undefined,
  openaiKey: string | undefined
): { provider: Provider; apiUrl: string; apiKey: string | undefined; model: string } {
  const role: 'interviewer' | 'diagnostician' = intent === 'interviewer' ? 'interviewer' : 'diagnostician'

  const provider: Provider =
    ((role === 'interviewer'
      ? Deno.env.get('INTERVIEWER_PROVIDER')
      : Deno.env.get('DIAGNOSTICIAN_PROVIDER')) as Provider | undefined) ?? 'anthropic'

  const anthropicUrl = Deno.env.get('ANTHROPIC_API_URL') ?? 'https://api.anthropic.com/v1/messages'
  const openaiUrl = 'https://api.openai.com/v1/chat/completions'

  const defaultUrl = provider === 'anthropic' ? anthropicUrl : openaiUrl
  const defaultKey = provider === 'anthropic' ? anthropicKey : openaiKey

  // The diagnostician role keeps its pre-existing custom-endpoint override
  // seam (built for a future fine-tuned-model swap) regardless of provider.
  const apiUrl = role === 'diagnostician' ? Deno.env.get('DIAGNOSTICIAN_API_URL') ?? defaultUrl : defaultUrl
  const apiKey = role === 'diagnostician' ? Deno.env.get('DIAGNOSTICIAN_API_KEY') ?? defaultKey : defaultKey

  const defaultModel =
    role === 'interviewer'
      ? provider === 'anthropic' ? 'claude-haiku-4-5' : 'gpt-4o-mini'
      : provider === 'anthropic' ? 'claude-sonnet-5' : 'gpt-4o'

  const model =
    role === 'interviewer'
      ? Deno.env.get('INTERVIEWER_MODEL_ID') ?? defaultModel
      : Deno.env.get('DIAGNOSTICIAN_MODEL_ID') ?? Deno.env.get('DIAGNOSTICIAN_MODEL') ?? defaultModel

  return { provider, apiUrl, apiKey, model }
}

function stripJsonFences(text: string): string {
  let t = text.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```[a-zA-Z]*\n?/, '')
    if (t.endsWith('```')) t = t.slice(0, -3)
  }
  return t.trim()
}

type LlmCallResult = {
  parsed: unknown
  rawResponseBody: unknown
  latencyMs: number
  inputTokens: number | null
  outputTokens: number | null
  requestMessages: Array<{ role: string; content: string }>
}

async function callLlm(
  provider: Provider,
  apiUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPayload: unknown,
  temperature: number,
  retryNote?: string
): Promise<LlmCallResult> {
  const userContent = retryNote
    ? JSON.stringify({ ...(userPayload as object), validation_error: retryNote })
    : JSON.stringify(userPayload)

  const requestMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ]

  const startedAt = Date.now()

  if (provider === 'anthropic') {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
        temperature,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Anthropic error ${res.status}: ${text}`)
    }

    const data = await res.json()
    const latencyMs = Date.now() - startedAt
    const textBlock = (data.content ?? []).find((b: { type?: string }) => b.type === 'text')
    const text = textBlock?.text
    if (!text) throw new Error('Empty LLM response')

    return {
      parsed: JSON.parse(stripJsonFences(text)),
      rawResponseBody: data,
      latencyMs,
      inputTokens: data.usage?.input_tokens ?? null,
      outputTokens: data.usage?.output_tokens ?? null,
      requestMessages,
    }
  }

  // openai (rollback path)
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: requestMessages,
      temperature,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI error ${res.status}: ${text}`)
  }

  const data = await res.json()
  const latencyMs = Date.now() - startedAt
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty LLM response')

  return {
    parsed: JSON.parse(stripJsonFences(content)),
    rawResponseBody: data,
    latencyMs,
    inputTokens: data.usage?.prompt_tokens ?? null,
    outputTokens: data.usage?.completion_tokens ?? null,
    requestMessages,
  }
}

// ---------------------------------------------------------------------------
// Cost cap ($0.45 / intake)
// ---------------------------------------------------------------------------

type PriceEntry = { input: number; output: number }

// Prices per 1M tokens (USD). Verified against platform.claude.com/docs on
// 2026-08-03. Claude Sonnet 5 has introductory pricing through 2026-08-31;
// sonnetPrice() below is the one place that date lives.
const STATIC_PRICES: Record<string, PriceEntry> = {
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10.0 },
}

function sonnetPrice(): PriceEntry {
  // TODO: revert to the standard $3/$15 rate after 2026-08-31 — this date
  // check makes that automatic, but confirm platform.claude.com/docs still
  // agrees when that date arrives.
  const introExpiresAt = new Date('2026-09-01T00:00:00Z').getTime()
  return Date.now() < introExpiresAt ? { input: 2.0, output: 10.0 } : { input: 3.0, output: 15.0 }
}

function priceFor(modelId: string): PriceEntry {
  if (modelId === 'claude-sonnet-5') return sonnetPrice()
  const known = STATIC_PRICES[modelId]
  if (known) return known
  // Unknown model id (e.g. a fine-tuned DIAGNOSTICIAN_MODEL_ID) — fail safe
  // by over-estimating with the most expensive known rate rather than
  // letting spend escape the cap.
  return { input: 3.0, output: 15.0 }
}

function costForTokens(modelId: string, inputTokens: number, outputTokens: number): number {
  const price = priceFor(modelId)
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000
}

async function costSoFar(admin: SupabaseClient, intakeId: string): Promise<number> {
  const { data, error } = await admin
    .from('llm_traces')
    .select('model_id, input_tokens, output_tokens')
    .eq('intake_id', intakeId)
  if (error) throw error

  const byModel: Record<string, { input: number; output: number }> = {}
  for (const row of data ?? []) {
    const key = row.model_id as string
    const bucket = byModel[key] ?? { input: 0, output: 0 }
    bucket.input += row.input_tokens ?? 0
    bucket.output += row.output_tokens ?? 0
    byModel[key] = bucket
  }

  let total = 0
  for (const [modelId, tokens] of Object.entries(byModel)) {
    total += costForTokens(modelId, tokens.input, tokens.output)
  }
  return total
}

const PROJECTED_TOKENS: Record<Intent, { input: number; output: number }> = {
  interviewer: { input: 2000, output: 500 },
  diagnostician_hypothesis: { input: 4000, output: 800 },
  diagnostician_final: { input: 6000, output: 2000 },
  get_intake: { input: 0, output: 0 },
  signed_url: { input: 0, output: 0 },
}

function projectedCallCost(intent: Intent, modelId: string): number {
  const t = PROJECTED_TOKENS[intent]
  return costForTokens(modelId, t.input, t.output)
}

// ---------------------------------------------------------------------------
// Safety-urgency validator + low-confidence / per-cause clamp
// (deterministic, post-parse — never trusted to the prompt)
// ---------------------------------------------------------------------------

const SAFETY_DISCLAIMER_PREFIX =
  'IMPORTANT: The symptoms described include signs of a possible safety-critical issue. Do not drive until a qualified mechanic has inspected the vehicle. '

const SAFETY_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /brake.*(fail|floor|grinding|no response|nothing)/i, reason: 'brake_failure' },
  { pattern: /steering.*(loss|binding|wander|off.?center)/i, reason: 'steering_failure' },
  { pattern: /(smoke|fire|fuel smell|gasoline smell)/i, reason: 'fire_hazard' },
  { pattern: /(overheating|temperature.*red|steam)/i, reason: 'overheating' },
]

function getLastHypothesisConfidence(conversation: Array<{ role: string; content: unknown }>): number | null {
  for (let i = conversation.length - 1; i >= 0; i--) {
    const m = conversation[i]
    if (m.role !== 'diagnostician') continue
    const c = m.content as { type?: string; confidence?: number }
    if (c?.type === 'hypothesis' && typeof c.confidence === 'number') return c.confidence
  }
  return null
}

function buildSafetyHaystacks(
  conversation: Array<{ role: string; content: unknown }>
): { generalText: string; warningLightsText: string } {
  // Answers reference their question by id (answer_to), not by intent — so
  // first map question id -> intent from the interviewer's own question
  // batches, then use that to find which answers were to warning_lights.
  const intentById: Record<string, string> = {}
  for (const m of conversation) {
    if (m.role !== 'interviewer') continue
    const c = m.content as { type?: string; questions?: Array<{ id?: string; question_intent?: string }> }
    if (c?.type === 'question_batch') {
      for (const q of c.questions ?? []) {
        if (q.id && q.question_intent) intentById[q.id] = q.question_intent
      }
    }
  }

  const generalParts: string[] = []
  const warningLightsParts: string[] = []

  for (const m of conversation) {
    const c = m.content as Record<string, unknown> | undefined
    if (!c) continue
    const pieces: string[] = []
    if (typeof c.free_text === 'string') pieces.push(c.free_text)
    if (typeof c.value === 'string') pieces.push(c.value)
    if (Array.isArray(c.value)) pieces.push((c.value as unknown[]).filter((v) => typeof v === 'string').join(' '))
    if (typeof c.text_content === 'string') pieces.push(c.text_content)
    const text = pieces.join(' ')
    if (!text) continue
    generalParts.push(text)
    const intent = typeof c.answer_to === 'string' ? intentById[c.answer_to] : undefined
    if (intent === 'warning_lights') warningLightsParts.push(text)
  }

  return { generalText: generalParts.join(' '), warningLightsText: warningLightsParts.join(' ') }
}

type BriefLike = Record<string, unknown> & {
  urgency: string
  urgencyLabel: string
  disclaimer: string
  confidence?: number
  probableCauses: Array<{ cause: string; confidence: number }>
}

function finalizeBrief(
  brief: BriefLike,
  ctx: {
    mediaSummary: Array<{ kind: string; text_content?: string }>
    conversation: Array<{ role: string; content: unknown }>
  }
): { brief: BriefLike; overrideReason: string | null; lowConfidence: boolean } {
  const lowConfidence = typeof brief.confidence === 'number' && brief.confidence < LOW_CONFIDENCE_THRESHOLD

  let working: BriefLike = brief
  if (lowConfidence) {
    working = {
      ...working,
      probableCauses: working.probableCauses.map((c) => ({
        ...c,
        confidence: Math.min(c.confidence, PER_CAUSE_CLAMP),
      })),
    }
  }

  const { generalText, warningLightsText } = buildSafetyHaystacks(ctx.conversation)
  const mediaText = ctx.mediaSummary
    .filter((m) => m.kind === 'text' && typeof m.text_content === 'string')
    .map((m) => m.text_content)
    .join(' ')
  const haystack = `${generalText} ${mediaText}`

  let matchedReason: string | null = null
  for (const { pattern, reason } of SAFETY_PATTERNS) {
    if (pattern.test(haystack)) {
      matchedReason = reason
      break
    }
  }
  if (!matchedReason && /\b(airbag|srs)\b/i.test(warningLightsText)) {
    matchedReason = 'airbag_warning'
  }

  let overrideReason: string | null = null
  if (matchedReason && working.urgency !== 'immediate') {
    overrideReason = matchedReason
    working = {
      ...working,
      urgency: 'immediate',
      urgencyLabel: 'Immediate safety risk',
      disclaimer: `${SAFETY_DISCLAIMER_PREFIX}${working.disclaimer}`,
    }
  }

  return { brief: working, overrideReason, lowConfidence }
}

// ---------------------------------------------------------------------------
// Streaming (diagnostician_final only)
// ---------------------------------------------------------------------------

function extractPartialBrief(text: string): Record<string, unknown> {
  const partial: Record<string, unknown> = { type: 'final' }

  const stringField = (key: string) => {
    const m = text.match(new RegExp(`"${key}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`,))
    if (m) partial[key] = m[1].replace(/\\"/g, '"')
  }

  stringField('category')
  stringField('urgency')
  stringField('urgencyLabel')
  stringField('disclaimer')

  const estimateMatch = text.match(/"estimateRange"\s*:\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]/)
  if (estimateMatch) {
    partial.estimateRange = [Number(estimateMatch[1]), Number(estimateMatch[2])]
  }

  const causesMatch = text.match(/"probableCauses"\s*:\s*(\[[\s\S]*?\])\s*,\s*"/)
  if (causesMatch) {
    try {
      partial.probableCauses = JSON.parse(causesMatch[1])
    } catch {
      /* partial array not yet complete */
    }
  }

  const componentsMatch = text.match(/"componentsToInspect"\s*:\s*(\[[\s\S]*?\])\s*,\s*"/)
  if (componentsMatch) {
    try {
      partial.componentsToInspect = JSON.parse(componentsMatch[1])
    } catch {
      /* partial array not yet complete */
    }
  }

  const symptomMatch = text.match(/"symptomLanguage"\s*:\s*(\[[\s\S]*?\])\s*,\s*"/)
  if (symptomMatch) {
    try {
      partial.symptomLanguage = JSON.parse(symptomMatch[1])
    } catch {
      /* partial array not yet complete */
    }
  }

  const inputsMatch = text.match(/"inputs"\s*:\s*(\{[\s\S]*?\})/)
  if (inputsMatch) {
    try {
      partial.inputs = JSON.parse(inputsMatch[1])
    } catch {
      /* partial object not yet complete */
    }
  }

  return partial
}

function streamDiagnosticianFinal(
  admin: SupabaseClient,
  intakeId: string,
  provider: Provider,
  apiUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPayload: Record<string, unknown>,
  hint: string,
  spentBeforeCall: number
): Response {
  const encoder = new TextEncoder()
  let lastPartialKey = ''
  const streamStartedAt = Date.now()

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (obj: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`))
      }

      const initialUserContent = JSON.stringify(userPayload)
      const initialRequestMessages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: initialUserContent },
      ]

      // Fires exactly once per stream, right before the terminal outcome
      // (success or validation failure) — never awaited, per the
      // EdgeRuntime.waitUntil note above.
      const insertTrace = (fields: {
        requestMessages: Array<{ role: string; content: string }>
        rawResponseBody: unknown
        responseParsed: unknown
        parseError: string | null
        inputTokens: number | null
        outputTokens: number | null
      }) => {
        const promptVersion = Deno.env.get('DIAGNOSTICIAN_PROMPT_SHA') ?? 'unknown'
        const insertPromise = admin.from('llm_traces').insert({
          intake_id: intakeId,
          role: 'diagnostician',
          round_number: (userPayload as { round?: number })?.round ?? null,
          model_id: model,
          prompt_version: promptVersion,
          prompt_input: { messages: fields.requestMessages },
          response_raw: fields.rawResponseBody,
          response_parsed: fields.responseParsed,
          parse_error: fields.parseError,
          latency_ms: Date.now() - streamStartedAt,
          input_tokens: fields.inputTokens,
          output_tokens: fields.outputTokens,
        })
        EdgeRuntime.waitUntil(
          insertPromise.then(() => {}).catch((err) => console.error('[llm_traces] insert failed', err))
        )
      }

      try {
        const requestBody =
          provider === 'anthropic'
            ? {
                model,
                max_tokens: ANTHROPIC_MAX_TOKENS,
                system: systemPrompt,
                messages: [{ role: 'user', content: initialUserContent }],
                temperature: DIAGNOSTICIAN_TEMPERATURE,
                stream: true,
              }
            : {
                model,
                stream: true,
                response_format: { type: 'json_object' },
                messages: initialRequestMessages,
                temperature: DIAGNOSTICIAN_TEMPERATURE,
              }

        const headers =
          provider === 'anthropic'
            ? {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
              }
            : {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              }

        const res = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(requestBody) })

        if (!res.ok) {
          const text = await res.text()
          insertTrace({
            requestMessages: initialRequestMessages,
            rawResponseBody: { error: text },
            responseParsed: null,
            parseError: `LLM error ${res.status}: ${text}`,
            inputTokens: null,
            outputTokens: null,
          })
          enqueue({ type: 'error', code: 'llm_error', message: text })
          controller.close()
          return
        }

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let content = ''
        let streamInputTokens: number | null = null
        let streamOutputTokens: number | null = null

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const data = trimmed.slice(5).trim()
            if (data === '[DONE]') continue
            try {
              const parsedEvent = JSON.parse(data)
              if (provider === 'anthropic') {
                if (parsedEvent.type === 'content_block_delta' && parsedEvent.delta?.type === 'text_delta') {
                  content += parsedEvent.delta.text ?? ''
                } else if (parsedEvent.type === 'message_start') {
                  streamInputTokens = parsedEvent.message?.usage?.input_tokens ?? streamInputTokens
                } else if (parsedEvent.type === 'message_delta') {
                  streamOutputTokens = parsedEvent.usage?.output_tokens ?? streamOutputTokens
                }
              } else {
                const delta = parsedEvent.choices?.[0]?.delta?.content
                if (delta) content += delta
              }
            } catch {
              /* ignore malformed SSE chunks */
            }
          }

          const partial = extractPartialBrief(content)
          const partialKey = JSON.stringify(partial)
          if (partialKey !== lastPartialKey && Object.keys(partial).length > 1) {
            lastPartialKey = partialKey
            enqueue({ type: 'partial', brief: partial })
          }
        }

        let parsed: unknown
        try {
          parsed = JSON.parse(stripJsonFences(content))
        } catch {
          insertTrace({
            requestMessages: initialRequestMessages,
            rawResponseBody: { content },
            responseParsed: null,
            parseError: 'Invalid JSON from model',
            inputTokens: streamInputTokens,
            outputTokens: streamOutputTokens,
          })
          enqueue({ type: 'error', code: 'validation_failed', message: 'Invalid JSON from model' })
          controller.close()
          return
        }

        let result = FinalBriefSchema.safeParse(parsed)
        let finalRequestMessages = initialRequestMessages
        let finalRawResponseBody: unknown = { content }
        let finalInputTokens: number | null = streamInputTokens
        let finalOutputTokens: number | null = streamOutputTokens

        if (!result.success) {
          const retryCall = await callLlm(
            provider,
            apiUrl,
            apiKey,
            model,
            systemPrompt,
            userPayload,
            DIAGNOSTICIAN_TEMPERATURE,
            `Your response failed validation: ${formatZodError(result.error)}. Reply with valid JSON matching this schema: ${hint}`
          )
          parsed = retryCall.parsed
          result = FinalBriefSchema.safeParse(parsed)
          finalRequestMessages = retryCall.requestMessages
          finalRawResponseBody = retryCall.rawResponseBody
          finalInputTokens = retryCall.inputTokens
          finalOutputTokens = retryCall.outputTokens
        }

        if (!result.success) {
          insertTrace({
            requestMessages: finalRequestMessages,
            rawResponseBody: finalRawResponseBody,
            responseParsed: null,
            parseError: formatZodError(result.error),
            inputTokens: finalInputTokens,
            outputTokens: finalOutputTokens,
          })
          enqueue({
            type: 'error',
            code: 'validation_failed',
            message: formatZodError(result.error),
          })
          controller.close()
          return
        }

        const conversation = (userPayload.conversation as Array<{ role: string; content: unknown }>) ?? []
        const mediaSummary =
          (userPayload.media_summary as Array<{ kind: string; text_content?: string }>) ?? []
        const priorConfidence = getLastHypothesisConfidence(conversation)
        const rawBrief = result.data as BriefLike
        const briefWithConfidence: BriefLike = {
          ...rawBrief,
          confidence: rawBrief.confidence ?? priorConfidence ?? undefined,
        }

        const { brief, overrideReason, lowConfidence } = finalizeBrief(briefWithConfidence, {
          mediaSummary,
          conversation,
        })

        insertTrace({
          requestMessages: finalRequestMessages,
          rawResponseBody: finalRawResponseBody,
          responseParsed: brief,
          parseError: overrideReason ? `safety_override:${overrideReason}` : null,
          inputTokens: finalInputTokens,
          outputTokens: finalOutputTokens,
        })

        const thisCallCost = costForTokens(model, finalInputTokens ?? 0, finalOutputTokens ?? 0)

        const { error: updateError } = await admin
          .from('intakes')
          .update({
            brief,
            status: 'complete',
            urgency: brief.urgency,
            category: brief.category,
            low_confidence: lowConfidence,
            llm_cost_usd: spentBeforeCall + thisCallCost,
          })
          .eq('id', intakeId)

        if (updateError) {
          enqueue({ type: 'error', code: 'brief_persist_failed', message: updateError.message })
          controller.close()
          return
        }

        enqueue({ type: 'complete', result: brief })
        controller.close()
      } catch (err) {
        enqueue({
          type: 'error',
          code: 'internal_error',
          message: err instanceof Error ? err.message : 'Unknown error',
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
    },
  })
}

// ---------------------------------------------------------------------------
// Access control, rate limiting, media/bundle helpers (unchanged)
// ---------------------------------------------------------------------------

async function isRateLimited(admin: SupabaseClient, intakeId: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_WINDOW_MINUTES * 60 * 1000).toISOString()
  const { count, error } = await admin
    .from('llm_call_log')
    .select('*', { count: 'exact', head: true })
    .eq('intake_id', intakeId)
    .gt('called_at', since)

  if (error) throw error
  return (count ?? 0) >= RATE_LIMIT
}

async function canAccessIntake(
  admin: SupabaseClient,
  intakeId: string,
  userId: string | null
): Promise<boolean> {
  const { data: intake, error } = await admin
    .from('intakes')
    .select('shop_id, created_at, status')
    .eq('id', intakeId)
    .maybeSingle()

  if (error || !intake) return false

  const createdAt = new Date(intake.created_at).getTime()
  if (Date.now() - createdAt <= 30 * 60 * 1000) return true

  if (userId && (await isAnnotatorOrAdmin(admin, userId))) {
    const { data: rating } = await admin
      .from('intake_ratings')
      .select('intake_id')
      .eq('intake_id', intakeId)
      .maybeSingle()
    if (rating) return true
  }

  if (userId && intake.shop_id) {
    const { data: member } = await admin
      .from('shop_members')
      .select('shop_id')
      .eq('shop_id', intake.shop_id)
      .eq('user_id', userId)
      .maybeSingle()
    return !!member
  }

  return false
}

async function isAnnotatorOrAdmin(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.role === 'admin' || data?.role === 'annotator'
}

async function canCallLlm(
  admin: SupabaseClient,
  intakeId: string,
  userId: string | null
): Promise<boolean> {
  const { data: intake } = await admin
    .from('intakes')
    .select('status, created_at, shop_id')
    .eq('id', intakeId)
    .maybeSingle()

  if (!intake || intake.status === 'complete') return false

  const createdAt = new Date(intake.created_at).getTime()
  if (Date.now() - createdAt <= 30 * 60 * 1000) return true

  if (userId && intake.shop_id) {
    const { data: member } = await admin
      .from('shop_members')
      .select('shop_id')
      .eq('shop_id', intake.shop_id)
      .eq('user_id', userId)
      .maybeSingle()
    return !!member
  }

  return false
}

function buildMediaSummary(media: Array<Record<string, unknown>>) {
  return media.map((m) => {
    if (m.kind === 'text') {
      return { kind: 'text', text_content: m.text_content }
    }
    if (m.kind === 'audio') {
      return {
        kind: 'audio',
        duration_seconds: m.duration_seconds ?? undefined,
        media_id: m.id,
      }
    }
    return { kind: m.kind, media_id: m.id }
  })
}

async function fetchIntakeBundle(admin: SupabaseClient, intakeId: string) {
  const [intakeRes, messagesRes, mediaRes] = await Promise.all([
    admin.from('intakes').select('*').eq('id', intakeId).single(),
    admin
      .from('intake_messages')
      .select('id, role, content, created_at')
      .eq('intake_id', intakeId)
      .order('created_at', { ascending: true }),
    admin
      .from('intake_media')
      .select('id, kind, storage_path, text_content, mime_type, duration_seconds, created_at')
      .eq('intake_id', intakeId)
      .order('created_at', { ascending: true }),
  ])

  if (intakeRes.error) throw intakeRes.error
  if (messagesRes.error) throw messagesRes.error
  if (mediaRes.error) throw mediaRes.error

  const mediaWithUrls = await Promise.all(
    (mediaRes.data ?? []).map(async (m) => {
      if (!m.storage_path) return { ...m, signed_url: null }
      const { data } = await admin.storage
        .from('intake-media')
        .createSignedUrl(m.storage_path, SIGNED_URL_TTL_SECONDS)
      return { ...m, signed_url: data?.signedUrl ?? null }
    })
  )

  const ratingRes = await admin
    .from('intake_ratings')
    .select('*')
    .eq('intake_id', intakeId)
    .maybeSingle()

  return {
    intake: intakeRes.data,
    messages: messagesRes.data ?? [],
    media: mediaWithUrls,
    rating: ratingRes.data ?? null,
  }
}

function jsonOk(data: unknown) {
  return new Response(JSON.stringify({ ok: true, ...data as object }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function jsonError(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>
) {
  return new Response(JSON.stringify({ ok: false, error: { code, message, ...extra } }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
