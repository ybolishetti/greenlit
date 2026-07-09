// Pure display/derivation helpers for the shop dashboard. No data fetching —
// all functions take already-loaded `intakes` rows (as returned by
// listShopIntakes) and derive UI state from real columns only.

export function relativeTime(dateStr) {
  if (!dateStr) return ''
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function dayBucketLabel(dateStr) {
  const day = startOfDay(new Date(dateStr))
  const today = startOfDay(new Date())
  const diffDays = Math.round((today - day) / (24 * 60 * 60 * 1000))

  const weekdayDate = day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  if (diffDays === 0) return `Today — ${weekdayDate}`
  if (diffDays === 1) return `Yesterday — ${weekdayDate}`
  return weekdayDate
}

export function isRecentDay(dayISO) {
  const day = startOfDay(new Date(dayISO))
  const today = startOfDay(new Date())
  const diffDays = Math.round((today - day) / (24 * 60 * 60 * 1000))
  return diffDays <= 1
}

export function groupIntakesByDay(intakes) {
  const groups = new Map()
  for (const intake of intakes) {
    const day = startOfDay(new Date(intake.created_at)).toISOString()
    if (!groups.has(day)) groups.set(day, [])
    groups.get(day).push(intake)
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([day, dayIntakes]) => ({
      day,
      label: dayBucketLabel(dayIntakes[0].created_at),
      intakes: dayIntakes,
    }))
}

export function isArchived(intake) {
  return Boolean(intake.archived_at)
}

export function isPendingReview(intake) {
  return !isArchived(intake) && intake.status === 'complete' && !intake.rating
}

export function getIntakeStatus(intake) {
  if (isArchived(intake)) return 'archived'
  if (intake.status === 'in_progress') return 'in_progress'
  if (intake.rating) return 'rated'
  return 'new'
}

export function computeOverviewMetrics(intakes) {
  const now = new Date()
  const todayStart = startOfDay(now)
  const weekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)

  const active = intakes.filter((i) => !isArchived(i))
  const today = active.filter((i) => new Date(i.created_at) >= todayStart).length
  const thisWeek = active.filter((i) => new Date(i.created_at) >= startOfDay(weekAgo)).length
  const pendingReview = active.filter(isPendingReview).length

  const withConfidence = active.filter((i) => i.brief?.probableCauses?.[0]?.confidence != null)
  const avgConfidence = withConfidence.length
    ? Math.round(
        withConfidence.reduce((sum, i) => sum + i.brief.probableCauses[0].confidence, 0) /
          withConfidence.length
      )
    : null

  return { today, thisWeek, pendingReview, avgConfidence }
}

export function cardSummary(intake) {
  if (intake.brief?.probableCauses?.[0]?.cause) return intake.brief.probableCauses[0].cause
  if (intake.brief?.symptomLanguage?.[0]) return intake.brief.symptomLanguage[0]
  if (intake.category) return intake.category
  return 'Waiting on customer'
}

export function vehicleLabel(intake) {
  const v = intake.vehicle
  if (!v) return intake.customer_name || 'Unknown vehicle'
  return [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Unknown vehicle'
}
