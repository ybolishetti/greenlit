import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import {
  FinalBriefSchema,
  formatZodError,
  getSchemaForIntent,
  schemaHintForIntent,
} from './schemas.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RATE_LIMIT = 20
const RATE_WINDOW_MINUTES = 5
const SIGNED_URL_TTL_SECONDS = 300

type Intent =
  | 'interviewer'
  | 'diagnostician_hypothesis'
  | 'diagnostician_final'
  | 'get_intake'
  | 'signed_url'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
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

      const brief = stubResult.data
      const { error: updateError } = await admin
        .from('intakes')
        .update({
          brief,
          status: 'complete',
          urgency: brief.urgency,
          category: brief.category,
        })
        .eq('id', intakeId)

      if (updateError) return jsonError(500, 'brief_persist_failed', updateError.message)
      return jsonOk({ result: brief })
    }

    // LLM intents
    if (!intakeId) return jsonError(400, 'missing_intake_id', 'intake_id is required')

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

    if (!openaiKey) {
      return jsonError(503, 'llm_unconfigured', 'OPENAI_API_KEY not configured')
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

    const systemPrompt = await loadPrompt(intent)
    const model =
      intent === 'interviewer'
        ? Deno.env.get('INTERVIEWER_MODEL_ID') ?? 'gpt-4o-mini'
        : Deno.env.get('DIAGNOSTICIAN_MODEL_ID') ??
          Deno.env.get('DIAGNOSTICIAN_MODEL') ??
          'gpt-4o'

    const apiUrl = intent === 'interviewer'
      ? 'https://api.openai.com/v1/chat/completions'
      : Deno.env.get('DIAGNOSTICIAN_API_URL') ?? 'https://api.openai.com/v1/chat/completions'
    const apiKey =
      intent === 'interviewer'
        ? openaiKey
        : Deno.env.get('DIAGNOSTICIAN_API_KEY') ?? openaiKey

    const schema = getSchemaForIntent(intent)!
    const hint = schemaHintForIntent(intent)

    if (intent === 'diagnostician_final' && payload.stream) {
      await admin.from('llm_call_log').insert({ intake_id: intakeId })
      return streamDiagnosticianFinal(
        admin,
        intakeId!,
        apiUrl,
        apiKey,
        model,
        systemPrompt,
        llmPayload,
        hint
      )
    }

    let raw = await callOpenAi(apiUrl, apiKey, model, systemPrompt, llmPayload)
    let parsed: unknown
    let result = schema.safeParse(raw)

    if (!result.success) {
      raw = await callOpenAi(
        apiUrl,
        apiKey,
        model,
        systemPrompt,
        llmPayload,
        `Your response failed validation: ${formatZodError(result.error)}. Reply with valid JSON matching this schema: ${hint}`
      )
      result = schema.safeParse(raw)
    }

    if (!result.success) {
      return jsonError(422, 'validation_failed', formatZodError(result.error), {
        raw_output: raw,
        schema_hint: hint,
      })
    }

    parsed = result.data

    await admin.from('llm_call_log').insert({ intake_id: intakeId })

    if (intent === 'diagnostician_final') {
      const brief = FinalBriefSchema.parse(parsed)
      const { error: updateError } = await admin
        .from('intakes')
        .update({
          brief,
          status: 'complete',
          urgency: brief.urgency,
          category: brief.category,
        })
        .eq('id', intakeId)

      if (updateError) {
        return jsonError(500, 'brief_persist_failed', updateError.message)
      }
    }

    return jsonOk({ result: parsed })
  } catch (err) {
    console.error(err)
    return jsonError(500, 'internal_error', err instanceof Error ? err.message : 'Unknown error')
  }
})

async function loadPrompt(intent: string): Promise<string> {
  if (intent === 'interviewer') {
    return await Deno.readTextFile(new URL('./prompts/interviewer.md', import.meta.url))
  }
  return await Deno.readTextFile(new URL('./prompts/diagnostician.md', import.meta.url))
}

async function callOpenAi(
  apiUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPayload: unknown,
  retryNote?: string
): Promise<unknown> {
  const userContent = retryNote
    ? JSON.stringify({ ...(userPayload as object), validation_error: retryNote })
    : JSON.stringify(userPayload)

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.4,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI error ${res.status}: ${text}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty LLM response')
  return JSON.parse(content)
}

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
  apiUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPayload: unknown,
  hint: string
): Response {
  const encoder = new TextEncoder()
  let lastPartialKey = ''

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (obj: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`))
      }

      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            stream: true,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: JSON.stringify(userPayload) },
            ],
            temperature: 0.4,
          }),
        })

        if (!res.ok) {
          const text = await res.text()
          enqueue({ type: 'error', code: 'llm_error', message: text })
          controller.close()
          return
        }

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let content = ''

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
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content
              if (delta) content += delta
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
          parsed = JSON.parse(content)
        } catch {
          enqueue({ type: 'error', code: 'validation_failed', message: 'Invalid JSON from model' })
          controller.close()
          return
        }

        let result = FinalBriefSchema.safeParse(parsed)
        if (!result.success) {
          parsed = await callOpenAi(
            apiUrl,
            apiKey,
            model,
            systemPrompt,
            userPayload,
            `Your response failed validation: ${formatZodError(result.error)}. Reply with valid JSON matching this schema: ${hint}`
          )
          result = FinalBriefSchema.safeParse(parsed)
        }

        if (!result.success) {
          enqueue({
            type: 'error',
            code: 'validation_failed',
            message: formatZodError(result.error),
          })
          controller.close()
          return
        }

        const brief = result.data
        const { error: updateError } = await admin
          .from('intakes')
          .update({
            brief,
            status: 'complete',
            urgency: brief.urgency,
            category: brief.category,
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
