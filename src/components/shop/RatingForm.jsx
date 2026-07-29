import { useState } from 'react'

export default function RatingForm({ onSubmit, submitLabel = 'Save rating' }) {
  const [onTarget, setOnTarget] = useState('yes')
  const [repair, setRepair] = useState('')
  const [accuracyScore, setAccuracyScore] = useState(null)
  const [comment, setComment] = useState('')

  return (
    <div className="rounded-lg border border-line bg-ink/30 p-4">
      <p className="text-xs font-medium text-text-dim">Was the brief's diagnosis on target?</p>
      <div className="mt-2 flex gap-2">
        {['yes', 'partially', 'no'].map((v) => (
          <button
            key={v}
            onClick={() => setOnTarget(v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
              onTarget === v ? 'bg-brand text-ink' : 'border border-line text-text-dim'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <input
        value={repair}
        onChange={(e) => setRepair(e.target.value)}
        placeholder="What was the actual repair performed?"
        className="mt-3 w-full rounded-lg border border-line bg-panel p-2.5 text-xs text-text placeholder:text-text-mute focus:border-brand/50 focus:outline-none"
      />

      <div className="mt-3">
        <p className="text-xs font-medium text-text-dim">
          How accurate was Greenlit? (0 = totally off, 100 = spot-on)
        </p>
        <div className="mt-1.5 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={accuracyScore ?? 50}
            onChange={(e) => setAccuracyScore(Number(e.target.value))}
            className="w-full"
          />
          <span className="w-8 shrink-0 text-right text-xs text-text/80">
            {accuracyScore ?? '—'}
          </span>
        </div>
      </div>

      <p className="mt-3 text-xs font-medium text-text-dim">Anything else worth flagging? (optional)</p>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="e.g. missed a subsystem, misread the customer's language, urgency was wrong, brief nailed it."
        className="mt-1.5 w-full rounded-lg border border-line bg-panel p-2.5 text-xs text-text placeholder:text-text-mute focus:border-brand/50 focus:outline-none"
      />

      <button
        onClick={() => onSubmit({ onTarget, repairPerformed: repair, accuracyScore, comment })}
        className="mt-3 rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-ink hover:bg-brand-dim"
      >
        {submitLabel}
      </button>
    </div>
  )
}
