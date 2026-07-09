import { useMemo } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import IntakeRow from '../../components/shop/IntakeRow'
import { computeOverviewMetrics, isArchived } from '../../lib/shop/intakeDisplay'

export default function OverviewTab() {
  const { intakes, loaded, slug } = useOutletContext()
  const metrics = useMemo(() => computeOverviewMetrics(intakes), [intakes])
  const recent = useMemo(
    () => intakes.filter((i) => !isArchived(i)).slice(0, 10),
    [intakes]
  )

  return (
    <div>
      <h2 className="text-2xl font-semibold text-text">Overview</h2>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Today's intakes" value={metrics.today} />
        <StatCard label="This week" value={metrics.thisWeek} />
        <StatCard label="Pending review" value={metrics.pendingReview} />
        <StatCard
          label="Avg confidence"
          value={metrics.avgConfidence != null ? `${metrics.avgConfidence}%` : '—'}
          hint="Avg. of each brief's top probable cause"
        />
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-mute">Recent intakes</h3>
          <Link to="intakes" className="text-sm text-brand hover:underline">
            View all →
          </Link>
        </div>

        {loaded && recent.length === 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-line p-8 text-center">
            <p className="text-sm text-text-dim">No intakes yet.</p>
            <Link
              to="kit"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
            >
              Print your QR kit →
            </Link>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {recent.map((intake) => (
            <IntakeRow key={intake.id} intake={intake} slug={slug} />
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4" title={hint}>
      <p className="text-xs uppercase tracking-wide text-text-mute">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text">{value}</p>
    </div>
  )
}
