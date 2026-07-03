export default function OptionCard({ label, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
        selected
          ? 'border-lime bg-lime/10 text-white'
          : 'border-line bg-panel text-white/70 hover:border-white/30'
      }`}
    >
      {label}
    </button>
  )
}
