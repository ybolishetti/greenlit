export function isAdminEmail(email) {
  const list = (import.meta.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return list.includes(email?.toLowerCase())
}
