import { Info, X } from 'lucide-react'

export default function DemoActionExplainer({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="mt-4 flex items-start gap-2 rounded-lg border border-brand/30 bg-brand-soft px-3 py-2.5 text-sm text-brand">
      <Info size={15} className="mt-0.5 shrink-0" />
      <p className="flex-1">{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 text-brand/70 hover:text-brand">
          <X size={14} />
        </button>
      )}
    </div>
  )
}
