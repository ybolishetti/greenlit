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

/**
 * Stream NDJSON events from llm-proxy (diagnostician_final with stream:true).
 * @returns {AsyncGenerator<{ type: string, brief?: object, result?: object, code?: string, message?: string }>}
 */
export async function* invokeEdgeStream(intent, intakeId, payload = {}) {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/llm-proxy`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: session?.access_token
        ? `Bearer ${session.access_token}`
        : `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ intent, intake_id: intakeId, payload }),
  })

  if (!res.ok) {
    const text = await res.text()
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      /* ignore */
    }
    const err = new Error(parsed?.error?.message || text || 'Edge Function stream failed')
    err.code = parsed?.error?.code || 'edge_error'
    throw err
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      yield JSON.parse(trimmed)
    }
  }

  if (buffer.trim()) {
    yield JSON.parse(buffer.trim())
  }
}
