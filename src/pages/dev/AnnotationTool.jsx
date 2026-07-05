import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import AuthGate from '../../components/AuthGate'
import { getIntake } from '../../lib/db'
import {
  getAnnotations,
  isAnnotator,
  listRatedIntakes,
  saveAnnotation,
} from '../../lib/db/annotations'

export default function AnnotationTool() {
  const [allowed, setAllowed] = useState(null)
  const [intakes, setIntakes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [bundle, setBundle] = useState(null)
  const [annotations, setAnnotations] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    isAnnotator()
      .then(setAllowed)
      .catch(() => setAllowed(false))
  }, [])

  useEffect(() => {
    if (!allowed) return
    listRatedIntakes()
      .then(setIntakes)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [allowed])

  const loadIntake = async (intakeId) => {
    setSelectedId(intakeId)
    setError(null)
    try {
      const [data, existing] = await Promise.all([getIntake(intakeId), getAnnotations(intakeId)])
      setBundle(data)
      const byMessage = Object.fromEntries(
        existing.map((a) => [a.message_id, a.annotation])
      )
      setAnnotations(byMessage)
    } catch (err) {
      setError(err.message)
    }
  }

  const updateDraft = (messageId, field, value) => {
    setAnnotations((prev) => ({
      ...prev,
      [messageId]: {
        best_next_question: prev[messageId]?.best_next_question ?? '',
        reasoning: prev[messageId]?.reasoning ?? '',
        [field]: value,
      },
    }))
  }

  const save = async (messageId) => {
    const annotation = annotations[messageId]
    if (!annotation?.best_next_question?.trim()) return
    setSaving(messageId)
    try {
      await saveAnnotation(selectedId, messageId, {
        best_next_question: annotation.best_next_question.trim(),
        reasoning: annotation.reasoning?.trim() ?? '',
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  if (allowed === null) {
    return <p className="py-20 text-center text-text-dim">Checking access…</p>
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <p className="text-text-dim">Annotator access required. Contact an admin to grant the annotator role.</p>
        <Link to="/" className="mt-4 inline-block text-brand">
          Back home
        </Link>
      </div>
    )
  }

  return (
    <AuthGate shopSlug="demo-shop">
      {() => (
        <div className="mx-auto max-w-5xl px-6 py-12">
          <h1 className="text-2xl font-semibold text-text">Training annotation tool</h1>
          <p className="mt-1 text-sm text-text-dim">
            Label the best next question at each conversation step for rated intakes.
          </p>

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}

          <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
            <aside>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-mute">Rated intakes</h2>
              {loading ? (
                <p className="mt-4 text-sm text-text-dim">
                  <Loader2 size={14} className="inline animate-spin" /> Loading…
                </p>
              ) : intakes.length === 0 ? (
                <p className="mt-4 text-sm text-text-dim">No rated intakes yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {intakes.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => loadIntake(row.id)}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                          selectedId === row.id
                            ? 'border-brand/50 bg-brand-soft text-brand'
                            : 'border-line bg-panel text-text/80 hover:border-brand/30'
                        }`}
                      >
                        <span className="font-medium">{row.category || 'Intake'}</span>
                        <span className="mt-0.5 block text-xs text-text-mute">
                          {row.vehicle
                            ? `${row.vehicle.year} ${row.vehicle.make} ${row.vehicle.model}`
                            : row.id.slice(0, 8)}
                          {' · '}
                          {row.rating?.on_target}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </aside>

            <main>
              {!bundle ? (
                <p className="text-sm text-text-dim">Select an intake to annotate.</p>
              ) : (
                <>
                  <div className="rounded-xl border border-line bg-panel p-4 text-sm">
                    <p className="font-medium text-text">
                      {bundle.intake.vehicle
                        ? `${bundle.intake.vehicle.year} ${bundle.intake.vehicle.make} ${bundle.intake.vehicle.model}`
                        : 'Unknown vehicle'}
                    </p>
                    <p className="mt-1 text-text-dim">
                      Outcome: {bundle.rating?.on_target} — {bundle.rating?.repair_performed || 'No repair notes'}
                    </p>
                  </div>

                  <div className="mt-6 space-y-4">
                    {bundle.messages.map((msg) => (
                      <div key={msg.id} className="rounded-xl border border-line bg-panel p-4">
                        <p className="text-xs uppercase tracking-wide text-text-mute">{msg.role}</p>
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-text/70">
                          {JSON.stringify(msg.content, null, 2)}
                        </pre>

                        {(msg.role === 'interviewer' || msg.role === 'diagnostician') && (
                          <div className="mt-4 space-y-2 border-t border-line pt-4">
                            <label className="block text-xs font-medium text-text-mute">
                              Best next question
                            </label>
                            <input
                              value={annotations[msg.id]?.best_next_question ?? ''}
                              onChange={(e) => updateDraft(msg.id, 'best_next_question', e.target.value)}
                              placeholder="What should we have asked next?"
                              className="w-full rounded-lg border border-line bg-ink p-2 text-sm focus:border-brand/50 focus:outline-none"
                            />
                            <label className="block text-xs font-medium text-text-mute">Reasoning</label>
                            <textarea
                              value={annotations[msg.id]?.reasoning ?? ''}
                              onChange={(e) => updateDraft(msg.id, 'reasoning', e.target.value)}
                              rows={2}
                              placeholder="Why this question?"
                              className="w-full rounded-lg border border-line bg-ink p-2 text-sm focus:border-brand/50 focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={saving === msg.id}
                              onClick={() => save(msg.id)}
                              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brand-dim disabled:opacity-40"
                            >
                              {saving === msg.id ? 'Saving…' : 'Save annotation'}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </main>
          </div>
        </div>
      )}
    </AuthGate>
  )
}
