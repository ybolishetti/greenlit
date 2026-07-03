// Lightweight localStorage-backed store for demo purposes.
// In production this would be replaced with real API calls to a backend.

const INTAKES_KEY = 'greenlit_intakes_v1'

function readAll() {
  try {
    const raw = localStorage.getItem(INTAKES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeAll(intakes) {
  localStorage.setItem(INTAKES_KEY, JSON.stringify(intakes))
}

export function saveIntake(intake) {
  const all = readAll()
  all.unshift(intake)
  writeAll(all)
  return intake
}

export function getIntake(id) {
  return readAll().find((i) => i.id === id) || null
}

export function listIntakes({ shopId } = {}) {
  const all = readAll()
  if (shopId) return all.filter((i) => i.shopId === shopId)
  return all
}

export function updateIntake(id, patch) {
  const all = readAll()
  const idx = all.findIndex((i) => i.id === id)
  if (idx === -1) return null
  all[idx] = { ...all[idx], ...patch }
  writeAll(all)
  return all[idx]
}

export function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

export function seedDemoData() {
  const existing = readAll()
  if (existing.length > 0) return
  const demo = [
    {
      id: makeId(),
      createdAt: Date.now() - 1000 * 60 * 60 * 20,
      shopId: 'demo-shop',
      category: 'brakes',
      descriptor: 'squeal',
      timing: 'braking',
      duration: 'weeks',
      warningLight: 'none',
      feel: { pedal: 6, steering: 1, vibration: 2 },
      notes: 'High pitched squeal every time I brake, especially in the morning.',
      hasAudio: true,
      hasPhoto: false,
      customerName: 'J. Alvarez',
      status: 'new',
    },
    {
      id: makeId(),
      createdAt: Date.now() - 1000 * 60 * 60 * 44,
      shopId: 'demo-shop',
      category: 'engine',
      descriptor: 'knock',
      timing: 'accelerating',
      duration: 'few-days',
      warningLight: 'check-engine',
      feel: { pedal: 3, steering: 1, vibration: 4 },
      notes: 'Knocking sound when I accelerate from a stop, check engine light came on yesterday.',
      hasAudio: true,
      hasPhoto: true,
      customerName: 'M. Chen',
      status: 'rated',
      rating: { onTarget: 'yes', repairPerformed: 'Replaced spark plugs and ignition coil' },
    },
  ]
  writeAll(demo)
}
