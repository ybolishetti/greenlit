/** In-memory intake store for demo mode when Supabase is not configured. */

const intakes = new Map()

export function memoryCreateIntake({ shopSlug, vehicle } = {}) {
  const id = crypto.randomUUID()
  const intake = {
    id,
    shop_id: null,
    shop_slug: shopSlug ?? null,
    vehicle: vehicle ?? null,
    status: 'in_progress',
    brief: null,
    urgency: null,
    category: null,
    customer_name: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    messages: [],
    media: [],
    rating: null,
  }
  intakes.set(id, intake)
  return intake
}

export function memoryGetIntake(id) {
  const intake = intakes.get(id)
  if (!intake) return null
  const { messages, media, rating, ...row } = intake
  return { intake: row, messages, media, rating }
}

export function memoryAppendMessage(intakeId, role, content) {
  const intake = intakes.get(intakeId)
  if (!intake) throw new Error('Intake not found')
  const msg = { id: crypto.randomUUID(), role, content, created_at: new Date().toISOString() }
  intake.messages.push(msg)
  return msg
}

export function memoryUploadMedia(intakeId, { kind, file, textContent, durationSeconds }) {
  const intake = intakes.get(intakeId)
  if (!intake) throw new Error('Intake not found')
  const row = {
    id: crypto.randomUUID(),
    intake_id: intakeId,
    kind,
    text_content: textContent ?? null,
    storage_path: file ? `memory://${intakeId}/${kind}` : null,
    mime_type: file?.type ?? (kind === 'text' ? 'text/plain' : null),
    duration_seconds: durationSeconds ?? null,
    signed_url: file ? URL.createObjectURL(file) : null,
    created_at: new Date().toISOString(),
  }
  intake.media.push(row)
  return row
}

export function memoryCompleteIntake(intakeId, brief) {
  const intake = intakes.get(intakeId)
  if (!intake) throw new Error('Intake not found')
  intake.brief = brief
  intake.status = 'complete'
  intake.urgency = brief.urgency
  intake.category = brief.category
  intake.updated_at = new Date().toISOString()
}

export function memoryUpdateCustomerName(intakeId, name) {
  const intake = intakes.get(intakeId)
  if (intake) intake.customer_name = name || null
}

export function memoryListShopIntakes(_shopSlug) {
  return []
}

/** Consumer-side persistence (in-memory when Supabase is not configured). */

const consumerProfiles = new Map()
const consumerIntakes = new Map()
let memoryConsumerUserId = null

export function memoryUpsertConsumerProfile(user) {
  consumerProfiles.set(user.id, {
    id: user.id,
    email: user.email ?? null,
    display_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
  })
  memoryConsumerUserId = user.id
}

export function memorySaveConsumerIntake({ vehicle, inputs, brief, status = 'complete' }) {
  const id = crypto.randomUUID()
  const row = {
    id,
    user_id: memoryConsumerUserId,
    device_id: memoryConsumerUserId ? null : 'memory-device',
    vehicle,
    inputs,
    brief,
    status,
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    claimed_at: null,
  }
  consumerIntakes.set(id, row)
  return row
}

export function memoryClaimConsumerIntake(deviceId, intakeId) {
  const row = consumerIntakes.get(intakeId)
  if (!row || row.device_id !== deviceId || row.user_id) {
    throw new Error('Intake not found or already claimed')
  }
  row.user_id = memoryConsumerUserId ?? 'memory-user'
  row.status = 'claimed'
  row.claimed_at = new Date().toISOString()
  row.device_id = null
  return row
}

export function memoryListConsumerIntakes() {
  const uid = memoryConsumerUserId
  if (!uid) return []
  return [...consumerIntakes.values()]
    .filter((row) => row.user_id === uid)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

export function memoryGetConsumerIntake(id) {
  return consumerIntakes.get(id) ?? null
}

/** Saved vehicles (in-memory when Supabase is not configured). */

const savedVehicles = new Map()

export function memoryListSavedVehicles() {
  const uid = memoryConsumerUserId
  if (!uid) return []
  return [...savedVehicles.values()]
    .filter((row) => row.user_id === uid)
    .sort((a, b) => {
      if (a.is_default !== b.is_default) return a.is_default ? -1 : 1
      return new Date(b.created_at) - new Date(a.created_at)
    })
}

export function memoryCreateSavedVehicle({ year, make, model, mileage, nickname, isDefault }) {
  const uid = memoryConsumerUserId
  if (isDefault) {
    for (const row of savedVehicles.values()) {
      if (row.user_id === uid) row.is_default = false
    }
  }
  const id = crypto.randomUUID()
  const row = {
    id,
    user_id: uid,
    year,
    make,
    model,
    mileage: mileage ?? null,
    nickname: nickname ?? null,
    is_default: !!isDefault,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  savedVehicles.set(id, row)
  return row
}

export function memoryUpdateSavedVehicle(id, patch) {
  const row = savedVehicles.get(id)
  if (!row) throw new Error('Saved vehicle not found')
  Object.assign(row, patch, { updated_at: new Date().toISOString() })
  return row
}

export function memoryDeleteSavedVehicle(id) {
  savedVehicles.delete(id)
}

export function memorySetDefaultSavedVehicle(id) {
  const row = savedVehicles.get(id)
  if (!row) throw new Error('Saved vehicle not found')
  for (const v of savedVehicles.values()) {
    if (v.user_id === row.user_id) v.is_default = false
  }
  row.is_default = true
  row.updated_at = new Date().toISOString()
  return row
}
