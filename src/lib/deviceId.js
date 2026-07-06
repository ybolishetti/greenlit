const DEVICE_KEY = 'greenlit_device_id'
const INTAKE_USED_KEY = 'greenlit_intake_used'
const PENDING_CLAIM_KEY = 'greenlit_pending_claim'
const POST_AUTH_REDIRECT_KEY = 'greenlit_post_auth_redirect'

export function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

export function isIntakeSessionUsed() {
  return sessionStorage.getItem(INTAKE_USED_KEY) === '1'
}

export function markIntakeSessionUsed() {
  sessionStorage.setItem(INTAKE_USED_KEY, '1')
}

export function setPendingClaim({ deviceId, intakeId }) {
  sessionStorage.setItem(PENDING_CLAIM_KEY, JSON.stringify({ deviceId, intakeId }))
}

export function consumePendingClaim() {
  const raw = sessionStorage.getItem(PENDING_CLAIM_KEY)
  if (!raw) return null
  sessionStorage.removeItem(PENDING_CLAIM_KEY)
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setPostAuthRedirect(path) {
  sessionStorage.setItem(POST_AUTH_REDIRECT_KEY, path)
}

export function consumePostAuthRedirect() {
  const path = sessionStorage.getItem(POST_AUTH_REDIRECT_KEY)
  if (path) sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY)
  return path
}

export function getAuthModalModeForIntakeStart() {
  return isIntakeSessionUsed() ? 'limit' : 'start'
}
