import { isSupabaseConfigured, requireSupabase } from '../supabase.js'
import { getOrCreateDeviceId } from '../deviceId.js'
import {
  memoryClaimConsumerIntake,
  memoryGetConsumerIntake,
  memoryListConsumerIntakes,
  memorySaveConsumerIntake,
  memoryUpsertConsumerProfile,
} from '../intake/memoryStore.js'

export async function upsertConsumerProfile(user) {
  if (!isSupabaseConfigured) {
    memoryUpsertConsumerProfile(user)
    return
  }
  const sb = requireSupabase()
  const { error } = await sb.from('consumer_profiles').upsert({
    id: user.id,
    email: user.email ?? null,
    display_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function saveConsumerIntake({ vehicle, inputs, brief, status = 'complete' }) {
  if (!isSupabaseConfigured) {
    return memorySaveConsumerIntake({ vehicle, inputs, brief, status })
  }

  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()

  const row = {
    vehicle,
    inputs,
    brief,
    status,
    completed_at: new Date().toISOString(),
    user_id: session?.user?.id ?? null,
    device_id: session?.user ? null : getOrCreateDeviceId(),
  }

  const { data, error } = await sb.from('consumer_intakes').insert(row).select().single()
  if (error) throw error
  return data
}

export async function claimAnonymousIntake(deviceId, intakeId) {
  if (!isSupabaseConfigured) {
    return memoryClaimConsumerIntake(deviceId, intakeId)
  }
  const sb = requireSupabase()
  const { data, error } = await sb.rpc('claim_anonymous_intake', {
    p_device_id: deviceId,
    p_intake_id: intakeId,
  })
  if (error) throw error
  return data
}

export async function listConsumerIntakes() {
  if (!isSupabaseConfigured) return memoryListConsumerIntakes()
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('consumer_intakes')
    .select('id, vehicle, brief, status, created_at, completed_at, inputs')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getConsumerIntake(id) {
  if (!isSupabaseConfigured) return memoryGetConsumerIntake(id)
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('consumer_intakes')
    .select('id, vehicle, brief, status, created_at, completed_at, inputs')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}
