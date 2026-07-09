import { useState } from 'react'

export default function RatingForm({ onSubmit }) {
  const [onTarget, setOnTarget] = useState('yes')
  const [repair, setRepair] = useState('')

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
      <button
        onClick={() => onSubmit(onTarget, repair)}
        className="mt-3 rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-ink hover:bg-brand-dim"
      >
        Save rating
      </button>
    </div>
  )
}
