import { Loader2 } from 'lucide-react'

export default function AnalyzingState({ vehicle, answeredCount }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-6 text-center">
      <Loader2 className="mx-auto mb-3 animate-spin text-brand" size={20} />
      <p className="font-medium text-text">
        {answeredCount > 0 ? 'Analyzing your answers…' : 'Getting your questions ready…'}
      </p>
      <p className="mt-1 text-sm text-text-dim">
        Reviewing your vehicle info and symptoms to figure out what to ask next.
      </p>
      {vehicle && (
        <p className="mt-3 text-xs text-text-mute">
          {vehicle.year} {vehicle.make} {vehicle.model}
          {answeredCount > 0 ? ` · ${answeredCount} question${answeredCount === 1 ? '' : 's'} answered so far` : ''}
        </p>
      )}
    </div>
  )
}
