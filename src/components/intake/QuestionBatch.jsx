import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import QuestionField from './QuestionField'

export default function QuestionBatch({ batch, onSubmit, submitting }) {
  const [answers, setAnswers] = useState({})
  const [step, setStep] = useState(0)
  const questions = batch.questions
  const current = questions[step]

  const setAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const canAdvance = () => {
    const val = answers[current.id]
    if (current.ui.type === 'multi_select') return Array.isArray(val) && val.length > 0
    if (current.ui.type === 'toggle') return typeof val === 'boolean'
    if (current.ui.type === 'natural_language') return typeof val === 'string' && val.trim().length > 0
    if (current.ui.type === 'media_request') return val != null
    return val != null && val !== ''
  }

  const next = () => {
    if (step < questions.length - 1) setStep((s) => s + 1)
    else {
      onSubmit(
        questions.map((q) => ({
          type: 'answer',
          answer_to: q.id,
          value: answers[q.id],
          free_text: q.ui.type === 'natural_language' ? answers[q.id] : undefined,
        }))
      )
      setAnswers({})
      setStep(0)
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-panel p-6">
      <p className="text-xs uppercase tracking-wide text-text-mute">
        Question {step + 1} of {questions.length} · Round {batch.round}
      </p>
      <h2 className="mt-2 text-lg font-semibold text-text">{current.prompt}</h2>
      <div className="mt-4">
        <QuestionField
          question={current}
          value={answers[current.id]}
          onChange={(v) => setAnswer(current.id, v)}
        />
      </div>
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={!canAdvance() || submitting}
          onClick={next}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-ink hover:bg-brand-dim disabled:opacity-40"
        >
          {step < questions.length - 1 ? 'Next' : 'Submit answers'}
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  )
}
