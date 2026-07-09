import { requireSupabase } from '../supabase'

export async function createShopLead(lead) {
  const sb = requireSupabase()
  const { error } = await sb.from('shop_leads').insert(lead)
  if (error) throw error
}

export async function listLeads() {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('shop_leads')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getLeadById(id) {
  const sb = requireSupabase()
  const { data, error } = await sb.from('shop_leads').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function updateLeadStatus(id, status) {
  const sb = requireSupabase()
  const patch = { status }
  if (status === 'contacted') patch.contacted_at = new Date().toISOString()
  const { error } = await sb.from('shop_leads').update(patch).eq('id', id)
  if (error) throw error
}

export async function convertLeadToShop(leadId, shopId) {
  const sb = requireSupabase()
  const { error } = await sb
    .from('shop_leads')
    .update({ converted_shop_id: shopId, status: 'active' })
    .eq('id', leadId)
  if (error) throw error
}
