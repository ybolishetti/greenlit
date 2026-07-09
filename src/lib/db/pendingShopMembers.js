import { requireSupabase } from '../supabase'

export async function listPending(shopId) {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('pending_shop_members')
    .select('id, shop_id, email, role, invited_by, created_at')
    .eq('shop_id', shopId)
    .is('claimed_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function invite(shopId, email, role = 'member') {
  const sb = requireSupabase()
  const { data: userData } = await sb.auth.getUser()
  const { data, error } = await sb
    .from('pending_shop_members')
    .insert({
      shop_id: shopId,
      email: email.trim().toLowerCase(),
      role,
      invited_by: userData?.user?.id ?? null,
    })
    .select()
    .single()
  if (error) {
    if (error.code === '23505') {
      throw new Error('That email already has a pending or existing invite for this shop.')
    }
    throw error
  }
  return data
}

export async function revokePending(id) {
  const sb = requireSupabase()
  const { error } = await sb.from('pending_shop_members').delete().eq('id', id)
  if (error) throw error
}
