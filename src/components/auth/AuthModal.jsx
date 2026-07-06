import { useEffect, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { isSupabaseConfigured } from '../../lib/supabase'
import { signInWithGoogle } from '../../lib/db'

const COPY = {
  start: {
    header: 'Save your intakes to your account',
    benefits: [
      'Your intake history saved across devices',
      'Faster re-intakes for recurring issues',
      'Get notified when your mechanic confirms the diagnosis',
    ],
  },
  limit: {
    header: 'Create an account to run more intakes',
    benefits: [
      'Your intake history saved across devices',
      'Faster re-intakes for recurring issues',
      'Get notified when your mechanic confirms the diagnosis',
    ],
  },
  login: {
    header: 'Save your intakes to your account',
    benefits: [
      'Your intake history saved across devices',
      'Faster re-intakes for recurring issues',
      'Get notified when your mechanic confirms the diagnosis',
    ],
  },
  claim: {
    header: 'Save your intakes to your account',
    benefits: [
      'Your intake history saved across devices',
      'Faster re-intakes for recurring issues',
      'Get notified when your mechanic confirms the diagnosis',
    ],
  },
}

export default function AuthModal({
  mode = 'start',
  disableSkip = false,
  onClose,
  onSkip,
  onBeforeOAuth,
}) {
  const overlayRef = useRef(null)
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState(null)

  const copy = COPY[mode] ?? COPY.start
  const showSkip = mode !== 'login' && !disableSkip

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showSkip) onSkip?.()
        else onClose?.()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, onSkip, showSkip])

  const handleBackdropClick = (e) => {
    if (e.target === overlayRef.current) {
      if (showSkip) onSkip?.()
      else onClose?.()
    }
  }

  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured) return
    setSigningIn(true)
    setError(null)
    try {
      onBeforeOAuth?.()
      const redirectTo = `${window.location.origin}${window.location.pathname}${window.location.search}`
      await signInWithGoogle(redirectTo)
    } catch (err) {
      setError(err.message || 'Sign-in failed')
      setSigningIn(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-xl">
        <button
          type="button"
          onClick={() => (showSkip ? onSkip?.() : onClose?.())}
          className="absolute right-4 top-4 rounded-lg p-1 text-text-mute hover:bg-line/50 hover:text-text"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <h2 id="auth-modal-title" className="pr-8 text-xl font-semibold text-text">
          {copy.header}
        </h2>

        <ul className="mt-5 space-y-3">
          {copy.benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-sm text-text-dim">
              <span className="mt-0.5 text-brand" aria-hidden>
                ✓
              </span>
              {benefit}
            </li>
          ))}
        </ul>

        {error && <p className="mt-4 text-xs text-danger">{error}</p>}

        <button
          type="button"
          disabled={signingIn || !isSupabaseConfigured}
          onClick={handleGoogleSignIn}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-ink hover:bg-brand-dim disabled:opacity-40"
        >
          {signingIn ? <Loader2 size={16} className="animate-spin" /> : null}
          Continue with Google
        </button>

        {!isSupabaseConfigured && (
          <p className="mt-3 text-center text-xs text-text-mute">
            Sign-in requires Supabase configuration. Demo mode works without an account.
          </p>
        )}

        {showSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="mt-4 w-full text-center text-sm text-text-mute hover:text-text-dim"
          >
            Skip for now, I'll create an account later
          </button>
        ) : null}
      </div>
    </div>
  )
}
