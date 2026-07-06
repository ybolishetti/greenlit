import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, FileText } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listConsumerIntakes } from '../lib/db'
import { isSupabaseConfigured } from '../lib/supabase'

function formatVehicle(vehicle) {
  if (!vehicle) return 'Intake'
  const parts = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean)
  return parts.join(' ') || 'Intake'
}

export default function Account() {
  const { isSignedIn, loading: authLoading, openAuthModal } = useAuth()
  const [intakes, setIntakes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (authLoading) return
    if (!isSignedIn) {
      setLoading(false)
      return
    }
    listConsumerIntakes()
      .then(setIntakes)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [isSignedIn, authLoading])

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-text-dim">
        <Loader2 className="mr-2 animate-spin" size={18} /> Loading…
      </div>
    )
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="text-text-dim">Account features require Supabase configuration.</p>
        <Link to="/" className="mt-4 inline-block text-brand">
          Back home
        </Link>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold text-text">My intakes</h1>
        <p className="mt-2 text-sm text-text-dim">Sign in to view your saved mechanic briefs.</p>
        <button
          type="button"
          onClick={() => openAuthModal({ mode: 'login', disableSkip: true })}
          className="mt-6 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-ink hover:bg-brand-dim"
        >
          Log in
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-text">My intakes</h1>
      <p className="mt-1 text-sm text-text-dim">Your saved mechanic briefs across devices.</p>

      {error && <p className="mt-6 text-sm text-danger">{error}</p>}

      {intakes.length === 0 && !error ? (
        <div className="mt-10 rounded-2xl border border-line bg-panel p-8 text-center">
          <FileText className="mx-auto text-text-mute" size={28} />
          <p className="mt-3 text-sm text-text-dim">No saved intakes yet.</p>
          <Link to="/" className="mt-4 inline-block text-sm text-brand hover:underline">
            Start your first intake
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {intakes.map((intake) => (
            <li key={intake.id}>
              <Link
                to={`/account/${intake.id}`}
                className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-4 hover:border-brand/50"
              >
                <div>
                  <p className="font-medium text-text">{formatVehicle(intake.vehicle)}</p>
                  <p className="mt-0.5 text-xs text-text-mute">
                    {intake.brief?.category ?? 'Mechanic brief'} ·{' '}
                    {new Date(intake.completed_at ?? intake.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs text-text-dim">{intake.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
