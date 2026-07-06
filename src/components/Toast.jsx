export default function Toast({ message, onDismiss }) {
  return (
    <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-xl border border-brand/30 bg-panel px-4 py-3 text-sm text-text shadow-lg">
        <span className="text-brand">✓</span>
        {message}
        <button
          type="button"
          onClick={onDismiss}
          className="ml-2 text-text-mute hover:text-text"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  )
}
