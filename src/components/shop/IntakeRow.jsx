import { Link } from 'react-router-dom'
import { Flag } from 'lucide-react'
import { cardSummary, getIntakeStatus, relativeTime, vehicleLabel } from '../../lib/shop/intakeDisplay'

const URGENCY_DOT = {
  immediate: 'bg-danger',
  monitor: 'bg-warn',
  routine: 'bg-ok',
}

const STATUS_LABEL = {
  in_progress: { label: 'In progress', dot: 'bg-warn' },
  new: { label: 'New', dot: 'bg-text-mute' },
  rated: { label: 'Rated', dot: 'bg-ok' },
  archived: { label: 'Archived', dot: 'bg-text-mute/40' },
}

export default function IntakeRow({ intake, slug, showStatus = false, showTime = 'relative' }) {
  const brief = intake.brief
  const waitingOnCustomer = !brief && intake.status !== 'complete'
  const urgency = brief?.urgency || intake.urgency || 'routine'
  const status = getIntakeStatus(intake)

  return (
    <Link
      to={`/shop/${slug}/intakes/${intake.id}`}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel p-4 hover:border-brand/40"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            waitingOnCustomer ? 'bg-text-mute/40' : URGENCY_DOT[urgency]
          }`}
        />
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium text-text">
            <span className="truncate">{vehicleLabel(intake)}</span>
            {intake.flagged && (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger">
                <Flag size={11} /> Flagged
              </span>
            )}
          </p>
          <p className="truncate text-xs text-text-dim">{cardSummary(intake)}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 text-xs text-text-mute">
        {showStatus && (
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_LABEL[status].dot}`} />
            {STATUS_LABEL[status].label}
          </span>
        )}
        <span>
          {showTime === 'relative'
            ? relativeTime(intake.created_at)
            : new Date(intake.created_at).toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
              })}
        </span>
      </div>
    </Link>
  )
}
