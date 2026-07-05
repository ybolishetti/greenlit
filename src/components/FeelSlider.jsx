export default function FeelSlider({
  label,
  lowLabel,
  highLabel,
  value,
  onChange,
  min = 0,
  max = 10,
  step = 1,
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-text">{label}</span>
        <span className="text-text-dim">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range-brand mt-3 w-full accent-brand"
      />
      <div className="mt-1 flex justify-between text-xs text-text-mute">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  )
}
