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
      media_summary: buildMediaSummary(bundle.media),
      conversation: bundle.messages.map((m: { role: string; content: unknown }) => ({
        role: m.role,
        content: m.content,
      })),
    }

    const systemPrompt = await loadPrompt(intent)
    const model =
      intent === 'interviewer'
        ? 'gpt-4o-mini'
        : Deno.env.get('DIAGNOSTICIAN_MODEL') ?? 'gpt-4o'

    // TODO: Replace DIAGNOSTICIAN_API_URL with fine-tuned Diagnostician model endpoint.
    const apiUrl = intent === 'interviewer'
      ? 'https://api.openai.com/v1/chat/completions'
      : Deno.env.get('DIAGNOSTICIAN_API_URL') ?? 'https://api.openai.com/v1/chat/completions'
    const apiKey =
      intent === 'interviewer'
        ? openaiKey
        : Deno.env.get('DIAGNOSTICIAN_API_KEY') ?? openaiKey

    const schema = getSchemaForIntent(intent)!
    const hint = schemaHintForIntent(intent)

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
    ? JSON.stringify({ ...userPayload as object, validation_error: retryNote })
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
    .select('shop_id, created_at')
    .eq('id', intakeId)
    .maybeSingle()

  if (error || !intake) return false

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
