import { isSupabaseConfigured, requireSupabase } from '../supabase.js'

export async function isAnnotator() {
  if (!isSupabaseConfigured) return import.meta.env.DEV
  const sb = requireSupabase()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return false

  const { data, error } = await sb
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return false
  return data?.role === 'admin' || data?.role === 'annotator'
}

export async function listRatedIntakes() {
  const sb = requireSupabase()
  const { data: ratings, error: ratingError } = await sb
    .from('intake_ratings')
    .select('intake_id, on_target, repair_performed, created_at')
    .order('created_at', { ascending: false })

  if (ratingError) throw ratingError
  if (!ratings?.length) return []

  const ids = ratings.map((r) => r.intake_id)
  const { data: intakes, error: intakeError } = await sb
    .from('intakes')
    .select('id, vehicle, category, urgency, status, created_at, customer_name')
    .in('id', ids)

  if (intakeError) throw intakeError

  const intakeById = Object.fromEntries((intakes ?? []).map((i) => [i.id, i]))
  return ratings
    .map((r) => ({
      ...intakeById[r.intake_id],
      rating: r,
    }))
    .filter((row) => row.id)
}

export async function getAnnotations(intakeId) {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('intake_annotations')
    .select('id, message_id, annotation, created_at')
    .eq('intake_id', intakeId)

  if (error) throw error
  return data ?? []
}

export async function saveAnnotation(intakeId, messageId, annotation) {
  const sb = requireSupabase()
  const {
    data: { user },
    error: userError,
  } = await sb.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Must be signed in')

  const { data: existing } = await sb
    .from('intake_annotations')
    .select('id')
    .eq('message_id', messageId)
    .maybeSingle()

  if (existing?.id) {
    const { data, error } = await sb
      .from('intake_annotations')
      .update({ annotation, annotated_by: user.id })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await sb
    .from('intake_annotations')
    .insert({
      intake_id: intakeId,
      message_id: messageId,
      annotation,
      annotated_by: user.id,
    })
    .select()
    .single()

  if (error) throw error
  return data
}
