import { requireSupabase } from '../supabase'

export async function listShopsWithMemberCounts() {
  const sb = requireSupabase()
  const { data: shops, error } = await sb.rpc('list_shops_admin')
  if (error) throw error

  const { data: members, error: memberError } = await sb.from('shop_members').select('shop_id')
  if (memberError) throw memberError

  const counts = {}
  for (const m of members || []) {
    counts[m.shop_id] = (counts[m.shop_id] || 0) + 1
  }

  return (shops || []).map((shop) => ({ ...shop, memberCount: counts[shop.id] || 0 }))
}

export async function updateShopSignupStatus(shopId, status) {
  const sb = requireSupabase()
  const { error } = await sb.from('shops').update({ signup_status: status }).eq('id', shopId)
  if (error) throw error
}

export async function createShop({ name, slug }) {
  const sb = requireSupabase()
  const { data, error } = await sb.from('shops').insert({ name, slug }).select().single()
  if (error) throw error
  return data
}

export async function updateShop(shopId, patch) {
  const sb = requireSupabase()
  const { error } = await sb.from('shops').update(patch).eq('id', shopId)
  if (error) throw error
}
