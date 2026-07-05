export default function OptionCard({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
        selected
          ? 'border-brand bg-brand-soft text-text'
          : 'border-line bg-panel text-text-dim hover:border-brand/40 hover:text-text'
      }`}
    >
      {label}
    </button>
  )
}
