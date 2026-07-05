import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.includes(serviceRoleKey)) {
      return jsonError(401, 'unauthorized', 'Service role authorization required')
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const rows = await exportRatedIntakes(admin)
    const jsonl = rows.map((row) => JSON.stringify(row)).join('\n')

    return new Response(jsonl, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/x-ndjson',
        'Content-Disposition': 'attachment; filename="greenlit-training.jsonl"',
      },
    })
  } catch (err) {
    console.error(err)
    return jsonError(500, 'internal_error', err instanceof Error ? err.message : 'Unknown error')
  }
})

async function exportRatedIntakes(admin: SupabaseClient) {
  const { data: ratings, error: ratingError } = await admin
    .from('intake_ratings')
    .select('intake_id, on_target, repair_performed, created_at')

  if (ratingError) throw ratingError
  if (!ratings?.length) return []

  const intakeIds = ratings.map((r) => r.intake_id)
  const ratingByIntake = Object.fromEntries(ratings.map((r) => [r.intake_id, r]))

  const [intakesRes, messagesRes, mediaRes] = await Promise.all([
    admin.from('intakes').select('id, vehicle, brief, created_at').in('id', intakeIds),
    admin
      .from('intake_messages')
      .select('id, intake_id, role, content, created_at')
      .in('intake_id', intakeIds)
      .order('created_at', { ascending: true }),
    admin
      .from('intake_media')
      .select('id, intake_id, kind, text_content, duration_seconds, created_at')
      .in('intake_id', intakeIds)
      .order('created_at', { ascending: true }),
  ])

  if (intakesRes.error) throw intakesRes.error
  if (messagesRes.error) throw messagesRes.error
  if (mediaRes.error) throw mediaRes.error

  const messagesByIntake: Record<string, unknown[]> = {}
  for (const msg of messagesRes.data ?? []) {
    if (!messagesByIntake[msg.intake_id]) messagesByIntake[msg.intake_id] = []
    messagesByIntake[msg.intake_id].push({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      created_at: msg.created_at,
    })
  }

  const mediaByIntake: Record<string, unknown[]> = {}
  for (const m of mediaRes.data ?? []) {
    if (!mediaByIntake[m.intake_id]) mediaByIntake[m.intake_id] = []
    if (m.kind === 'text') {
      mediaByIntake[m.intake_id].push({ kind: 'text', text_content: m.text_content })
    } else if (m.kind === 'audio') {
      mediaByIntake[m.intake_id].push({
        kind: 'audio',
        duration_seconds: m.duration_seconds ?? undefined,
        media_id: m.id,
      })
    } else {
      mediaByIntake[m.intake_id].push({ kind: m.kind, media_id: m.id })
    }
  }

  return (intakesRes.data ?? [])
    .filter((intake) => ratingByIntake[intake.id])
    .map((intake) => {
      const rating = ratingByIntake[intake.id]
      return {
        intake_id: intake.id,
        vehicle: intake.vehicle ?? null,
        messages: messagesByIntake[intake.id] ?? [],
        media_summary: mediaByIntake[intake.id] ?? [],
        brief: intake.brief ?? null,
        outcome: {
          diagnosis_on_target: rating.on_target === 'yes',
          on_target: rating.on_target,
          actual_repair: rating.repair_performed ?? null,
        },
        created_at: intake.created_at,
      }
    })
}

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
