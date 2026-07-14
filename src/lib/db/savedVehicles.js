import { isSupabaseConfigured, requireSupabase } from '../supabase.js'
import {
  memoryCreateSavedVehicle,
  memoryDeleteSavedVehicle,
  memoryListSavedVehicles,
  memorySetDefaultSavedVehicle,
  memoryUpdateSavedVehicle,
} from '../intake/memoryStore.js'

export async function listSavedVehicles() {
  if (!isSupabaseConfigured) return memoryListSavedVehicles()
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('saved_vehicles')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createSavedVehicle({ year, make, model, mileage, nickname, isDefault }) {
  if (!isSupabaseConfigured) {
    return memoryCreateSavedVehicle({ year, make, model, mileage, nickname, isDefault })
  }

  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  const userId = session?.user?.id
  if (!userId) throw new Error('Must be signed in to save a vehicle')

  if (isDefault) {
    const { error: unsetError } = await sb
      .from('saved_vehicles')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true)
    if (unsetError) throw unsetError
  }

  const row = {
    user_id: userId,
    year,
    make,
    model,
    mileage: mileage ?? null,
    nickname: nickname ?? null,
    is_default: !!isDefault,
  }

  const { data, error } = await sb.from('saved_vehicles').insert(row).select().single()
  if (error) throw error
  return data
}

export async function updateSavedVehicle(id, patch) {
  if (!isSupabaseConfigured) return memoryUpdateSavedVehicle(id, patch)
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('saved_vehicles')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSavedVehicle(id) {
  if (!isSupabaseConfigured) return memoryDeleteSavedVehicle(id)
  const sb = requireSupabase()
  const { error } = await sb.from('saved_vehicles').delete().eq('id', id)
  if (error) throw error
}

export async function setDefaultVehicle(id) {
  if (!isSupabaseConfigured) return memorySetDefaultSavedVehicle(id)

  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  const userId = session?.user?.id
  if (!userId) throw new Error('Must be signed in')

  const { error: unsetError } = await sb
    .from('saved_vehicles')
    .update({ is_default: false })
    .eq('user_id', userId)
    .eq('is_default', true)
  if (unsetError) throw unsetError

  const { data, error } = await sb
    .from('saved_vehicles')
    .update({ is_default: true })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
