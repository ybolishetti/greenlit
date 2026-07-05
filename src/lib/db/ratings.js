import { requireSupabase } from '../supabase.js'

export async function saveRating(intakeId, { onTarget, repairPerformed }) {
  const sb = requireSupabase()
  const {
    data: { user },
    error: userError,
  } = await sb.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Must be signed in to save a rating')

  const { data, error } = await sb
    .from('intake_ratings')
    .upsert(
      {
        intake_id: intakeId,
        rated_by: user.id,
        on_target: onTarget,
        repair_performed: repairPerformed || null,
      },
      { onConflict: 'intake_id' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}
