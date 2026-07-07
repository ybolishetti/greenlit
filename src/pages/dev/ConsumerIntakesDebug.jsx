import { useEffect, useState } from 'react'
import { debugListConsumerIntakes, getSession } from '../../lib/db'
import { isSupabaseConfigured } from '../../lib/supabase'

function isDebugAllowed() {
  if (import.meta.env.DEV) return true
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1') {
    return true
  }
  return false
}

export default function ConsumerIntakesDebug() {
  const [data, setData] = useState(null)
  const [blocked, setBlocked] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isDebugAllowed()) {
      setBlocked(true)
      return
    }

    ;(async () => {
      if (!import.meta.env.DEV && isSupabaseConfigured) {
        const session = await getSession()
        if (!session) {
          setBlocked(true)
          return
        }
      }
      try {
        const rows = await debugListConsumerIntakes()
        setData(rows)
      } catch (err) {
        setError(err.message)
      }
    })()
  }, [])

  if (blocked) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center text-text-dim">
        Debug view requires dev mode or ?debug=1 with an allowlisted account.
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center text-danger">{error}</div>
    )
  }

  if (!data) {
    return <div className="px-6 py-20 text-center text-text-dim">Loading consumer intakes…</div>
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-xl font-semibold text-text">Consumer intakes debug</h1>
      <p className="mt-1 text-sm text-text-dim">Most recent {data.length} consumer intakes</p>

      <Section title="Rows">
        <pre className="overflow-auto rounded-lg border border-line bg-panel p-4 text-xs text-text/80">
          {JSON.stringify(data, null, 2)}
        </pre>
      </Section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mt-8">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-mute">{title}</h2>
      {children}
    </div>
  )
}
