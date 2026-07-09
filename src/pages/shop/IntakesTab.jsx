import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Search } from 'lucide-react'
import IntakeRow from '../../components/shop/IntakeRow'
import { getIntakeStatus, groupIntakesByDay, isRecentDay, vehicleLabel } from '../../lib/shop/intakeDisplay'

const URGENCY_FILTERS = ['All', 'Immediate', 'Monitor', 'Routine']
const STATUS_FILTERS = ['All', 'New', 'In progress', 'Rated', 'Archived']

function matchesUrgency(intake, filter) {
  if (filter === 'All') return true
  const urgency = intake.brief?.urgency || intake.urgency
  return urgency === filter.toLowerCase()
}

function matchesStatus(intake, filter, status) {
  if (filter === 'All') return status !== 'archived'
  const map = { New: 'new', 'In progress': 'in_progress', Rated: 'rated', Archived: 'archived' }
  return status === map[filter]
}

function matchesSearch(intake, query) {
  if (!query) return true
  const haystack = [
    vehicleLabel(intake),
    intake.category,
    intake.customer_name,
    ...(intake.brief?.symptomLanguage || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query.toLowerCase())
}

export default function IntakesTab() {
  const { intakes, loaded, slug } = useOutletContext()
  const [urgencyFilter, setUrgencyFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [search, setSearch] = useState('')
  // Today/yesterday default-expanded, older days default-collapsed.
  // `toggledDays` holds days the user has manually flipped away from that default.
  const [toggledDays, setToggledDays] = useState(() => new Set())

  const filtered = useMemo(() => {
    return intakes.filter((intake) => {
      const status = getIntakeStatus(intake)
      if (!matchesUrgency(intake, urgencyFilter)) return false
      if (!matchesStatus(intake, statusFilter, status)) return false
      if (flaggedOnly && !intake.flagged) return false
      if (!matchesSearch(intake, search)) return false
      return true
    })
  }, [intakes, urgencyFilter, statusFilter, flaggedOnly, search])

  const groups = useMemo(() => groupIntakesByDay(filtered), [filtered])

  const toggleDay = (day) => {
    setToggledDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-text">Intakes</h2>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row">
        <aside className="w-full shrink-0 space-y-5 sm:w-44">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-mute">Urgency</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {URGENCY_FILTERS.map((f) => (
                <FilterChip key={f} active={urgencyFilter === f} onClick={() => setUrgencyFilter(f)}>
                  {f}
                </FilterChip>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-mute">Status</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((f) => (
                <FilterChip key={f} active={statusFilter === f} onClick={() => setStatusFilter(f)}>
                  {f}
                </FilterChip>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-text-dim">
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={(e) => setFlaggedOnly(e.target.checked)}
              className="rounded border-line"
            />
            Flagged only
          </label>

          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-mute" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-lg border border-line bg-panel py-1.5 pl-8 pr-2 text-xs text-text placeholder:text-text-mute focus:border-brand/50 focus:outline-none"
            />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {loaded && groups.length === 0 && (
            <p className="mt-6 text-center text-text-dim">
              {intakes.length === 0
                ? 'No intakes yet. Share your QR code to see them appear here.'
                : 'No intakes match these filters.'}
            </p>
          )}

          <div className="space-y-6">
            {groups.map((group) => {
              const defaultCollapsed = !isRecentDay(group.day)
              const collapsed = toggledDays.has(group.day) ? !defaultCollapsed : defaultCollapsed
              return (
                <div key={group.day}>
                  <button
                    onClick={() => toggleDay(group.day)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <h3 className="text-sm font-semibold text-text">
                      {group.label} <span className="text-text-mute">· ({group.intakes.length})</span>
                    </h3>
                    <span className="text-xs text-text-mute">{collapsed ? 'Show' : 'Hide'}</span>
                  </button>
                  {!collapsed && (
                    <div className="mt-3 space-y-2">
                      {group.intakes.map((intake) => (
                        <IntakeRow
                          key={intake.id}
                          intake={intake}
                          slug={slug}
                          showStatus
                          showTime="clock"
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active ? 'bg-brand text-ink' : 'border border-line text-text-dim hover:border-brand/50'
      }`}
    >
      {children}
    </button>
  )
}
