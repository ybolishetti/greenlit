import { requireSupabase } from '../supabase.js'

export async function signInWithGoogle(redirectTo) {
  const sb = requireSupabase()
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
  if (error) throw error
}

export async function signInWithMagicLink(email, redirectTo) {
  const sb = requireSupabase()
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  })
  if (error) throw error
}

export async function signOut() {
  const sb = requireSupabase()
  const { error } = await sb.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const sb = requireSupabase()
  const { data, error } = await sb.auth.getSession()
  if (error) throw error
  return data.session
}

export function onAuthStateChange(callback) {
  const sb = requireSupabase()
  const { data } = sb.auth.onAuthStateChange((event, session) => callback(event, session))
  return data.subscription
}
