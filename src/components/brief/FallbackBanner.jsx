import { Info } from 'lucide-react'

export default function FallbackBanner({ fallbackUsed }) {
  if (!fallbackUsed) return null

  return (
    <div className="mt-6 flex items-center gap-3 rounded-xl border border-line border-l-4 border-l-line bg-panel/60 px-4 py-3">
      <Info size={20} className="text-text-dim" />
      <div>
        <p className="font-medium text-text-dim">Simplified analysis used</p>
        <p className="text-xs text-text-dim">
          We used our simplified analysis for this brief while the AI service was having issues. A mechanic can
          still use it.
        </p>
      </div>
    </div>
  )
}
