import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import { getSession, signInWithMagicLink } from '../lib/db'

export default function AuthGate({ shopSlug, children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    getSession().then((s) => {
      setSession(s)
      setLoading(false)
    })
  }, [])

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <p className="text-text-dim">
          Configure Supabase env vars to use the shop dashboard with magic-link login.
        </p>
      </div>
    )
  }

  if (loading) {
    return <p className="py-20 text-center text-text-dim">Checking session…</p>
  }

  if (!session) {
    const redirectTo = `${window.location.origin}/shop/${shopSlug}/dashboard`
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-xl font-semibold text-text">Shop staff sign in</h1>
        <p className="mt-2 text-sm text-text-dim">We'll email you a magic link — no password.</p>
        {sent ? (
          <p className="mt-6 rounded-lg border border-brand/30 bg-brand-soft px-4 py-3 text-sm text-brand">
            Check your email for the sign-in link.
          </p>
        ) : (
          <form
            className="mt-6 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              setError(null)
              try {
                await signInWithMagicLink(email, redirectTo)
                setSent(true)
              } catch (err) {
                setError(err.message)
              }
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@shop.com"
              className="w-full rounded-xl border border-line bg-panel p-3 text-sm focus:border-brand/50 focus:outline-none"
            />
            {error && <p className="text-xs text-danger">{error}</p>}
            <button
              type="submit"
              className="w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-ink hover:bg-brand-dim"
            >
              Send magic link
            </button>
          </form>
        )}
      </div>
    )
  }

  return children({ session })
}
