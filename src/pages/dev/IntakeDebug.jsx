import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getIntake, getSession } from '../../lib/db'
import { isSupabaseConfigured } from '../../lib/supabase'

function isDebugAllowed() {
  if (import.meta.env.DEV) return true
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1') {
    return true
  }
  return false
}

export default function IntakeDebug() {
  const { id } = useParams()
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
        const bundle = await getIntake(id)
        setData(bundle)
      } catch (err) {
        setError(err.message)
      }
    })()
  }, [id])

  if (blocked) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center text-text-dim">
        Debug view requires dev mode or ?debug=1 with shop staff login.
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center text-danger">{error}</div>
    )
  }

  if (!data) {
    return <div className="px-6 py-20 text-center text-text-dim">Loading debug log…</div>
  }

  const hypotheses = data.messages.filter(
    (m) => m.role === 'diagnostician' && m.content?.type === 'hypothesis'
  )
  const systemEvents = data.messages.filter((m) => m.role === 'system')

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-xl font-semibold text-text">Intake debug · {id}</h1>
      <p className="mt-1 text-sm text-text-dim">Raw message log, media, hypotheses, system events</p>

      <Section title="Intake row">
        <pre className="overflow-auto rounded-lg border border-line bg-panel p-4 text-xs text-text/80">
          {JSON.stringify(data.intake, null, 2)}
        </pre>
      </Section>

      <Section title="Media">
        <pre className="overflow-auto rounded-lg border border-line bg-panel p-4 text-xs text-text/80">
          {JSON.stringify(data.media, null, 2)}
        </pre>
      </Section>

      <Section title="Diagnostician hypotheses">
        <pre className="overflow-auto rounded-lg border border-line bg-panel p-4 text-xs text-text/80">
          {JSON.stringify(hypotheses, null, 2)}
        </pre>
      </Section>

      <Section title="System events">
        <pre className="overflow-auto rounded-lg border border-line bg-panel p-4 text-xs text-text/80">
          {JSON.stringify(systemEvents, null, 2)}
        </pre>
      </Section>

      <Section title="Full message log">
        <pre className="overflow-auto rounded-lg border border-line bg-panel p-4 text-xs text-text/80">
          {JSON.stringify(data.messages, null, 2)}
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
