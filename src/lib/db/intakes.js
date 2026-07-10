import { isSupabaseConfigured, requireSupabase } from '../supabase.js'
import {
  memoryCompleteIntake,
  memoryCreateIntake,
  memoryGetIntake,
  memoryListShopIntakes,
  memoryUpdateCustomerName,
} from '../intake/memoryStore.js'
import { invokeEdge } from './edge.js'

export async function resolveShopId(slug) {
  if (!isSupabaseConfigured) return null
  if (!slug) return null
  const sb = requireSupabase()
  const { data, error } = await sb.from('shops').select('id').eq('slug', slug).maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

export async function getShopBySlug(slug) {
  if (!isSupabaseConfigured) {
    if (slug === 'demo-shop') return { id: 'demo', slug: 'demo-shop', name: 'Demo Shop' }
    return null
  }
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('shops')
    .select('id, slug, name, plan, address, contact_email, contact_phone, timezone, signup_status')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createIntake({ shopSlug, vehicle } = {}) {
  if (!isSupabaseConfigured) return memoryCreateIntake({ shopSlug, vehicle })
  const sb = requireSupabase()
  const shopId = shopSlug ? await resolveShopId(shopSlug) : null
  const { data, error } = await sb
    .from('intakes')
    .insert({ shop_id: shopId, vehicle: vehicle ?? null })
    .select('id, shop_id, status, vehicle, created_at')
    .single()
  if (error) throw error
  return data
}

export async function getIntake(intakeId) {
  if (!isSupabaseConfigured) {
    const data = memoryGetIntake(intakeId)
    if (!data) throw new Error('Intake not found')
    return data
  }
  const data = await invokeEdge('get_intake', intakeId)
  return {
    intake: data.intake,
    messages: data.messages ?? [],
    media: data.media ?? [],
    rating: data.rating ?? null,
  }
}

export async function listShopIntakes(shopSlug) {
  if (!isSupabaseConfigured) return memoryListShopIntakes(shopSlug)
  const sb = requireSupabase()
  const shop = await getShopBySlug(shopSlug)
  if (!shop) return []

  const { data, error } = await sb
    .from('intakes')
    .select(
      'id, shop_id, status, brief, urgency, category, customer_name, vehicle, created_at, updated_at, flagged, flagged_reason, flagged_at, archived_at'
    )
    .eq('shop_id', shop.id)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) throw error

  const ids = (data ?? []).map((i) => i.id)
  if (ids.length === 0) return []

  const { data: ratings, error: ratingError } = await sb
    .from('intake_ratings')
    .select('intake_id, on_target, repair_performed, created_at')
    .in('intake_id', ids)

  if (ratingError) throw ratingError

  const ratingByIntake = Object.fromEntries((ratings ?? []).map((r) => [r.intake_id, r]))

  return (data ?? []).map((intake) => ({
    ...intake,
    rating: ratingByIntake[intake.id] ?? null,
  }))
}

export async function completeIntakeStub(intakeId, brief) {
  if (!isSupabaseConfigured) {
    memoryCompleteIntake(intakeId, brief)
    return
  }
  await invokeEdge('diagnostician_final', intakeId, { stub_brief: brief })
}

export async function updateCustomerName(intakeId, customerName) {
  if (!isSupabaseConfigured) {
    memoryUpdateCustomerName(intakeId, customerName)
    return
  }
  const sb = requireSupabase()
  const { error } = await sb.from('intakes').update({ customer_name: customerName || null }).eq('id', intakeId)
  if (error) throw error
}

export async function flagIntake(intakeId, reason) {
  const sb = requireSupabase()
  const { error } = await sb
    .from('intakes')
    .update({ flagged: true, flagged_reason: reason || null, flagged_at: new Date().toISOString() })
    .eq('id', intakeId)
  if (error) throw error
}

export async function unflagIntake(intakeId) {
  const sb = requireSupabase()
  const { error } = await sb
    .from('intakes')
    .update({ flagged: false, flagged_reason: null, flagged_at: null })
    .eq('id', intakeId)
  if (error) throw error
}

export async function archiveIntake(intakeId) {
  const sb = requireSupabase()
  const { error } = await sb
    .from('intakes')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', intakeId)
  if (error) throw error
}

export async function unarchiveIntake(intakeId) {
  const sb = requireSupabase()
  const { error } = await sb.from('intakes').update({ archived_at: null }).eq('id', intakeId)
  if (error) throw error
}
