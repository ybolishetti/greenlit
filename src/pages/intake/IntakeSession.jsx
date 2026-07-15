import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import QuestionBatch from '../../components/intake/QuestionBatch'
import ConversationProgress from '../../components/intake/ConversationProgress'
import ErrorBanner from '../../components/ErrorBanner'
import {
  appendMessage,
  getIntake,
  updateCustomerName,
  uploadMedia,
} from '../../lib/db'
import {
  runDiagnosticianHypothesis,
  runInterviewer,
  isStubMode,
} from '../../lib/ai/client'
import { enrichQuestionBatch } from '../../lib/intake/uiRules.js'
import {
  countQuestionsAsked,
  getCurrentRound,
  getLastHypothesis,
  shouldForceDone,
} from '../../lib/intake/turnLimits'

function buildMediaSummary(media) {
  return media.map((m) => {
    if (m.kind === 'text') return { kind: 'text', text_content: m.text_content }
    if (m.kind === 'audio') {
      return { kind: 'audio', duration_seconds: m.duration_seconds ?? undefined, media_id: m.id }
    }
    return { kind: m.kind, media_id: m.id }
  })
}

function buildConversation(messages) {
  return messages.map((m) => ({ role: m.role, content: m.content }))
}

function buildLlmPayload(bundle) {
  return {
    round: getCurrentRound(bundle.messages),
    vehicle: bundle.intake.vehicle ?? null,
    media_summary: buildMediaSummary(bundle.media),
    conversation: buildConversation(bundle.messages),
  }
}

export default function IntakeSession() {
  const { id } = useParams()
  const navigate = useNavigate()
  const startedRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [messages, setMessages] = useState([])
  const [intake, setIntake] = useState(null)
  const [activeBatch, setActiveBatch] = useState(null)
  const [customerName, setCustomerName] = useState('')
  const [showNameStep, setShowNameStep] = useState(false)

  const applyBundle = (data) => {
    setIntake(data.intake)
    setMessages(data.messages)
    return data
  }

  const fetchAndApply = async () => {
    const data = await getIntake(id)
    applyBundle(data)
    return data
  }

  const requestInterviewer = async (bundle) => {
    const msgs = bundle.messages
    const round = getCurrentRound(msgs)
    await appendMessage(id, 'system', { type: 'system_event', event: 'round_start', round })
    const response = await runInterviewer(id, {
      ...buildLlmPayload(bundle),
      total_questions_asked: countQuestionsAsked(msgs),
      force_done: shouldForceDone(msgs),
      last_hypothesis: getLastHypothesis(msgs),
    })
    await appendMessage(id, 'interviewer', response)
    return response
  }

  /**
   * Diagnostician firing cadence (v2.1 — do not change without architecture review):
   *
   * The Diagnostician runs ONCE PER CYCLE (after the user submits a question batch),
   * not once per individual question. This mirrors how mechanics integrate a chunk of
   * new evidence before re-hypothesizing, and keeps latency/cost bounded.
   *
   * Do NOT "optimize" this into per-question Diagnostician calls — batching is intentional.
   */
  const runDiagnosticianRound = async (bundle) => {
    const round = getCurrentRound(bundle.messages)
    await appendMessage(id, 'system', { type: 'system_event', event: 'round_end', round })
    const hypothesis = await runDiagnosticianHypothesis(id, buildLlmPayload(bundle))
    await appendMessage(id, 'diagnostician', hypothesis)
    return hypothesis
  }

  const goToNameStep = () => {
    setShowNameStep(true)
    setActiveBatch(null)
  }

  const finishBrief = async () => {
    setProcessing(true)
    setError(null)
    try {
      if (customerName.trim()) await updateCustomerName(id, customerName.trim())
      const data = await fetchAndApply()
      navigate(`/brief/${id}`, {
        replace: true,
        state: {
          generate: true,
          payload: buildLlmPayload(data),
        },
      })
    } catch (err) {
      setError(err.message || 'Failed to start brief generation')
      setProcessing(false)
    }
  }

  const handleBatchSubmit = async (answers) => {
    setProcessing(true)
    setError(null)
    try {
      for (const answer of answers) {
        if (answer.value instanceof Blob || answer.value instanceof File) {
          const file =
            answer.value instanceof File
              ? answer.value
              : new File([answer.value], 'upload.webm', { type: answer.value.type })
          const kind = file.type.startsWith('video') ? 'video' : file.type.startsWith('image') ? 'photo' : 'audio'
          await uploadMedia(id, { kind, file })
          await appendMessage(id, 'user', {
            type: 'answer',
            answer_to: answer.answer_to,
            value: kind,
            free_text: `Uploaded ${kind}`,
          })
        } else {
          await appendMessage(id, 'user', answer)
        }
      }

      let bundle = await fetchAndApply()
      await runDiagnosticianRound(bundle)
      bundle = await fetchAndApply()

      if (shouldForceDone(bundle.messages)) {
        await appendMessage(id, 'system', {
          type: 'system_event',
          event: 'forced_done',
          details: { confidence: getLastHypothesis(bundle.messages)?.confidence },
        })
        goToNameStep()
        await fetchAndApply()
        return
      }

      bundle = await fetchAndApply()
      const response = await requestInterviewer(bundle)

      if (response.type === 'done') goToNameStep()
      else setActiveBatch(response)

      await fetchAndApply()
    } catch (err) {
      if (err.code === 'validation_failed') {
        await appendMessage(id, 'system', {
          type: 'system_event',
          event: 'validation_failed',
          details: err.details,
        })
        // Don't leak the raw validation error to end users. Present a plain retry-friendly message.
        setError('We hit a hiccup processing that answer. Tap Skip to jump to your brief, or reload to retry.')
      } else {
        setError(err.message || 'Something went wrong')
      }
      // Clear the stale batch so the user isn't looped back to the same questions.
      setActiveBatch(null)
    } finally {
      setProcessing(false)
    }
  }

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    ;(async () => {
      try {
        let bundle = await fetchAndApply()
        if (bundle.intake.status === 'complete') {
          navigate(`/brief/${id}`, { replace: true })
          return
        }

        const msgs = bundle.messages
        const lastInterviewer = [...msgs].reverse().find((m) => m.role === 'interviewer')

        if (lastInterviewer?.content?.type === 'done') {
          goToNameStep()
          return
        }

        if (lastInterviewer?.content?.type === 'question_batch') {
          const idx = msgs.indexOf(lastInterviewer)
          const hasAnswersAfter = msgs.slice(idx + 1).some((m) => m.role === 'user')
          if (!hasAnswersAfter) {
            setActiveBatch(enrichQuestionBatch(lastInterviewer.content))
            return
          }
        }

        if (!msgs.some((m) => m.role === 'interviewer')) {
          setProcessing(true)
          bundle = await fetchAndApply()
          const response = await requestInterviewer(bundle)
          if (response.type === 'done') goToNameStep()
          else setActiveBatch(response)
          await fetchAndApply()
          setProcessing(false)
        }
      } catch (err) {
        setError(err.message || 'Failed to load intake')
      } finally {
        setLoading(false)
      }
    })()
  }, [id, navigate])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-text-dim">
        <Loader2 className="mr-2 animate-spin" size={18} /> Loading intake…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {intake?.vehicle && (
        <p className="mb-4 text-xs text-text-mute">
          {intake.vehicle.year} {intake.vehicle.make} {intake.vehicle.model}
          {intake.vehicle.mileage != null ? ` · ${intake.vehicle.mileage.toLocaleString()} mi` : ''}
        </p>
      )}

      <ConversationProgress messages={messages} />

      {isStubMode() && (
        <p className="mb-4 rounded-lg border border-line bg-panel px-3 py-2 text-xs text-text-dim">
          Demo mode — using deterministic stub (no LLM key required).
        </p>
      )}

      <ErrorBanner
        message={error}
        onRetry={showNameStep ? finishBrief : undefined}
        onSkip={goToNameStep}
      />

      {showNameStep && (
        <div className="rounded-2xl border border-line bg-panel p-6">
          <h2 className="text-lg font-semibold text-text">Almost done</h2>
          <p className="mt-1 text-sm text-text-dim">Optional — your name for the shop.</p>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Your name (optional)"
            className="mt-4 w-full rounded-xl border border-line bg-ink p-3 text-sm focus:border-brand/50 focus:outline-none"
          />
          <button
            type="button"
            disabled={processing}
            onClick={finishBrief}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-ink hover:bg-brand-dim disabled:opacity-40"
          >
            {processing ? <Loader2 size={16} className="animate-spin" /> : null}
            Generate mechanic brief
          </button>
        </div>
      )}

      {!showNameStep && activeBatch && (
        <QuestionBatch batch={activeBatch} onSubmit={handleBatchSubmit} submitting={processing} />
      )}

      {!showNameStep && !activeBatch && processing && (
        <div className="flex items-center gap-2 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Thinking…
        </div>
      )}

      {intake && (
        <p className="mt-8 text-center text-xs text-text-mute">Intake {intake.id.slice(0, 8)}…</p>
      )}
    </div>
  )
}
