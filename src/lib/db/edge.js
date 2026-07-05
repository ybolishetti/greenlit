import { requireSupabase } from '../supabase.js'

export async function invokeEdge(intent, intakeId, payload = {}) {
  const sb = requireSupabase()
  const { data, error } = await sb.functions.invoke('llm-proxy', {
    body: { intent, intake_id: intakeId, payload },
  })

  if (error) {
    const err = new Error(error.message || 'Edge Function request failed')
    err.code = 'edge_error'
    err.cause = error
    throw err
  }

  if (!data?.ok) {
    const err = new Error(data?.error?.message || 'Edge Function returned an error')
    err.code = data?.error?.code || 'edge_error'
    err.details = data?.error
    throw err
  }

  return data
}
