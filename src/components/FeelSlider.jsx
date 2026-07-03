export default function FeelSlider({ label, lowLabel, highLabel, value, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-white">{label}</span>
        <span className="text-white/40">{value}/10</span>
      </div>
      <input
        type="range"
        min="0"
        max="10"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range-lime mt-3 w-full accent-lime"
      />
      <div className="mt-1 flex justify-between text-xs text-white/40">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  )
}
