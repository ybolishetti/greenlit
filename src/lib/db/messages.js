import { isSupabaseConfigured, requireSupabase } from '../supabase.js'
import { memoryAppendMessage } from '../intake/memoryStore.js'

export async function appendMessage(intakeId, role, content) {
  if (!isSupabaseConfigured) return memoryAppendMessage(intakeId, role, content)
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('intake_messages')
    .insert({ intake_id: intakeId, role, content })
    .select('id, role, content, created_at')
    .single()
  if (error) throw error
  return data
}
