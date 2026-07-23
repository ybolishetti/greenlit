import { ShieldAlert, ShieldQuestion, ShieldCheck } from 'lucide-react'

export const URGENCY_STYLE = {
  immediate: { icon: ShieldAlert, color: 'text-danger', bg: 'bg-danger/10', border: 'border-l-danger' },
  monitor: { icon: ShieldQuestion, color: 'text-warn', bg: 'bg-warn/10', border: 'border-l-warn' },
  routine: { icon: ShieldCheck, color: 'text-ok', bg: 'bg-ok/10', border: 'border-l-ok' },
}

export default function UrgencyBanner({ urgency, urgencyLabel, estimateRange }) {
  if (!urgency || !urgencyLabel) return null
  const style = URGENCY_STYLE[urgency] || URGENCY_STYLE.routine
  const Icon = style.icon

  return (
    <div className={`mt-6 flex items-center gap-3 rounded-xl border border-line border-l-4 ${style.border} ${style.bg} px-4 py-3`}>
      <Icon size={20} className={style.color} />
      <div>
        <p className={`font-medium ${style.color}`}>{urgencyLabel}</p>
        {estimateRange && (
          <p className="text-xs text-text-dim">
            Estimated repair range: ${estimateRange[0]}–${estimateRange[1]}
          </p>
        )}
      </div>
    </div>
  )
}
