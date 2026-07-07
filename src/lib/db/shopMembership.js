import { isSupabaseConfigured, requireSupabase } from '../supabase'

export async function getShopMembershipsForUser(userId) {
  if (!isSupabaseConfigured) return []
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('shop_members')
    .select('shop_id, role, shops(slug, name)')
    .eq('user_id', userId)
  if (error) return []
  return data || []
}

export async function getShopMembersWithEmail(shopId) {
  const sb = requireSupabase()
  const { data, error } = await sb.rpc('list_shop_members_with_email', { p_shop_id: shopId })
  if (error) throw error
  return data || []
}

export async function removeShopMember(shopId, userId) {
  const sb = requireSupabase()
  const { error } = await sb
    .from('shop_members')
    .delete()
    .eq('shop_id', shopId)
    .eq('user_id', userId)
  if (error) throw error
}
