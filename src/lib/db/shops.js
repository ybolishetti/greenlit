import { requireSupabase } from '../supabase'

export async function listShopsWithMemberCounts() {
  const sb = requireSupabase()
  const { data: shops, error } = await sb
    .from('shops')
    .select('id, slug, name, plan, address, contact_email, contact_phone, timezone, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error

  const { data: members, error: memberError } = await sb.from('shop_members').select('shop_id')
  if (memberError) throw memberError

  const counts = {}
  for (const m of members || []) {
    counts[m.shop_id] = (counts[m.shop_id] || 0) + 1
  }

  return (shops || []).map((shop) => ({ ...shop, memberCount: counts[shop.id] || 0 }))
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
