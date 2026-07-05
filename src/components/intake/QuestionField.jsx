import OptionCard from '../OptionCard'
import FeelSlider from '../FeelSlider'
import AudioRecorder from '../AudioRecorder'
import PhotoUpload from '../PhotoUpload'

export default function QuestionField({ question, value, onChange }) {
  const ui = question.ui

  if (ui.type === 'single_select') {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ui.options.map((opt) => (
          <OptionCard
            key={opt.value}
            label={opt.label}
            selected={value === opt.value}
            onClick={() => onChange(opt.value)}
          />
        ))}
      </div>
    )
  }

  if (ui.type === 'multi_select') {
    const selected = Array.isArray(value) ? value : []
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ui.options.map((opt) => {
          const active = selected.includes(opt.value)
          return (
            <OptionCard
              key={opt.value}
              label={opt.label}
              selected={active}
              onClick={() => {
                const next = active
                  ? selected.filter((v) => v !== opt.value)
                  : [...selected, opt.value]
                onChange(next)
              }}
            />
          )
        })}
      </div>
    )
  }

  if (ui.type === 'slider') {
    return (
      <FeelSlider
        label={question.prompt}
        lowLabel={ui.lowLabel}
        highLabel={ui.highLabel}
        value={typeof value === 'number' ? value : ui.min}
        min={ui.min}
        max={ui.max}
        step={ui.step}
        onChange={onChange}
      />
    )
  }

  if (ui.type === 'toggle') {
    const boolVal = typeof value === 'boolean' ? value : null
    return (
      <div className="flex gap-2">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              boolVal === v ? 'bg-brand text-ink' : 'border border-line text-text-dim'
            }`}
          >
            {v ? ui.trueLabel : ui.falseLabel}
          </button>
        ))}
      </div>
    )
  }

  if (ui.type === 'natural_language') {
    return (
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={ui.placeholder || 'Describe in your own words…'}
        rows={4}
        className="w-full rounded-xl border border-line bg-panel p-4 text-sm text-text placeholder:text-text-mute focus:border-brand/50 focus:outline-none"
      />
    )
  }

  if (ui.type === 'media_request') {
    return (
      <div>
        <p className="mb-3 text-sm text-text-dim">{ui.prompt}</p>
        {ui.kind === 'audio' && <AudioRecorder onCapture={(blob) => onChange(blob)} />}
        {ui.kind === 'photo' && <PhotoUpload onCapture={(files) => onChange(files?.[0] ?? null)} single />}
        {ui.kind === 'video' && (
          <p className="text-sm text-text-dim">Use your device camera from the intake capture step.</p>
        )}
      </div>
    )
  }

  return null
}
