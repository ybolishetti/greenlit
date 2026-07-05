export default function ErrorBanner({ message, onRetry, onSkip }) {
  if (!message) return null
  return (
    <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-text">
      <p>{message}</p>
      <div className="mt-2 flex gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-ink hover:bg-brand-dim"
          >
            Retry
          </button>
        )}
        {onSkip && (
          <button
            onClick={onSkip}
            className="rounded-lg border border-line px-3 py-1 text-xs text-text-dim hover:text-text"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  )
}
