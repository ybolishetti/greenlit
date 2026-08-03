import { Info } from 'lucide-react'

export default function LowConfidenceBanner({ lowConfidence }) {
  if (!lowConfidence) return null

  return (
    <div className="mt-6 flex items-center gap-3 rounded-xl border border-line border-l-4 border-l-line bg-panel/60 px-4 py-3">
      <Info size={20} className="text-text-dim" />
      <div>
        <p className="font-medium text-text-dim">Lower-confidence result</p>
        <p className="text-xs text-text-dim">
          We couldn&apos;t fully narrow this down. Treat the causes below as a starting point and confirm with a
          hands-on inspection.
        </p>
      </div>
    </div>
  )
}
