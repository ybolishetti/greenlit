import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { jsPDF } from 'jspdf'
import {
  CheckCircle2,
  Circle,
  Download,
  ExternalLink,
  LogOut,
  Trash2,
  X,
} from 'lucide-react'
import AuthGate from '../components/AuthGate'
import { getShopBySlug, listShopIntakes, saveRating, signOut } from '../lib/db'
import { getShopMembersWithEmail, removeShopMember } from '../lib/db/shopMembership'
import { useAuth } from '../context/AuthContext'

const SALES_EMAIL = import.meta.env.VITE_SALES_EMAIL || 'hello@greenlit.co'

const URGENCY_DOT = {
  immediate: 'bg-danger',
  monitor: 'bg-warn',
  routine: 'bg-ok',
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'intakes', label: 'Intakes' },
  { id: 'kit', label: 'Kit' },
  { id: 'team', label: 'Team' },
  { id: 'settings', label: 'Settings' },
]

export default function ShopDashboard() {
  const { shopId: shopSlug } = useParams()

  return (
    <AuthGate shopSlug={shopSlug}>
      {({ session }) => <DashboardInner shopSlug={shopSlug} session={session} />}
    </AuthGate>
  )
}

function DashboardInner({ shopSlug, session }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const activeTab = TABS.some((t) => t.id === requestedTab) ? requestedTab : 'overview'

  const [shop, setShop] = useState(null)
  const [intakes, setIntakes] = useState([])
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    const [shopRow, rows] = await Promise.all([getShopBySlug(shopSlug), listShopIntakes(shopSlug)])
    setShop(shopRow)
    setIntakes(rows)
    setLoaded(true)
  }, [shopSlug])

  useEffect(() => {
    refresh()
  }, [refresh])

  const setTab = (tab) => setSearchParams(tab === 'overview' ? {} : { tab })

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Header shopSlug={shopSlug} session={session} />
      <TabBar activeTab={activeTab} onChange={setTab} />

      {activeTab === 'overview' && (
        <OverviewTab intakes={intakes} loaded={loaded} onViewAll={() => setTab('intakes')} />
      )}
      {activeTab === 'intakes' && <IntakesTab intakes={intakes} loaded={loaded} refresh={refresh} />}
      {activeTab === 'kit' && <KitTab shop={shop} shopSlug={shopSlug} />}
      {activeTab === 'team' && <TeamTab shop={shop} />}
      {activeTab === 'settings' && <SettingsTab shop={shop} />}
    </div>
  )
}

function Header({ shopSlug, session }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Shop dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold text-text">Shop cockpit</h1>
        <p className="mt-1 text-xs text-text-mute">{session.user.email}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => signOut().then(() => window.location.reload())}
          className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-text"
        >
          <LogOut size={14} /> Sign out
        </button>
        <Link
          to={`/shop/${shopSlug}`}
          className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-text"
        >
          View QR page <ExternalLink size={13} />
        </Link>
      </div>
    </div>
  )
}

function TabBar({ activeTab, onChange }) {
  return (
    <div className="mt-6 flex gap-1 overflow-x-auto border-b border-line/60">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === t.id ? 'border-brand text-text' : 'border-transparent text-text-dim hover:text-text'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function computeMetrics(intakes) {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const thisWeek = intakes.filter((i) => new Date(i.created_at) >= weekAgo).length
  const thisMonth = intakes.filter((i) => new Date(i.created_at) >= monthStart).length

  const completed = intakes.filter((i) => i.status === 'complete' && i.updated_at)
  const avgMs = completed.length
    ? completed.reduce((sum, i) => sum + (new Date(i.updated_at) - new Date(i.created_at)), 0) /
      completed.length
    : null

  const rated = intakes.filter((i) => i.rating)
  const onTarget = rated.filter((i) => i.rating.on_target === 'yes').length

  return {
    thisWeek,
    thisMonth,
    avgTurnaround: avgMs != null ? formatDuration(avgMs) : '—',
    outcomeAccuracy: rated.length ? `${Math.round((onTarget / rated.length) * 100)}%` : '—',
  }
}

function formatDuration(ms) {
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

function OverviewTab({ intakes, loaded, onViewAll }) {
  const metrics = useMemo(() => computeMetrics(intakes), [intakes])
  const recent = intakes.slice(0, 5)

  return (
    <div className="mt-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="This week" value={metrics.thisWeek} />
        <MetricCard label="This month" value={metrics.thisMonth} />
        <MetricCard label="Avg turnaround" value={metrics.avgTurnaround} />
        <MetricCard label="Outcome accuracy" value={metrics.outcomeAccuracy} />
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-mute">Recent intakes</h2>
          <button onClick={onViewAll} className="text-sm text-brand hover:underline">
            View all →
          </button>
        </div>

        {loaded && recent.length === 0 && (
          <p className="mt-4 text-sm text-text-dim">
            No intakes yet. Share the QR code at drop-off to see them appear here.
          </p>
        )}

        <div className="mt-4 space-y-3">
          {recent.map((intake) => (
            <IntakeCard key={intake.id} intake={intake} readOnly />
          ))}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="text-xs uppercase tracking-wide text-text-mute">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text">{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Intakes
// ---------------------------------------------------------------------------

const FILTERS = ['All', 'Unrated', 'Today', 'This week', 'Urgent']

function filterIntakes(intakes, filter) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  switch (filter) {
    case 'Unrated':
      return intakes.filter((i) => !i.rating)
    case 'Today':
      return intakes.filter((i) => new Date(i.created_at) >= todayStart)
    case 'This week':
      return intakes.filter((i) => new Date(i.created_at) >= weekAgo)
    case 'Urgent':
      return intakes.filter((i) => (i.brief?.urgency || i.urgency) === 'immediate')
    default:
      return intakes
  }
}

function IntakesTab({ intakes, loaded, refresh }) {
  const [filter, setFilter] = useState('All')
  const [openRatingId, setOpenRatingId] = useState(null)

  const filtered = useMemo(() => filterIntakes(intakes, filter), [intakes, filter])

  const rate = async (id, onTarget, repairPerformed) => {
    await saveRating(id, { onTarget, repairPerformed })
    await refresh()
    setOpenRatingId(null)
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f ? 'bg-brand text-ink' : 'border border-line text-text-dim hover:border-brand/50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <UrgencyLegend />

      {loaded && filtered.length === 0 && (
        <p className="mt-10 text-center text-text-dim">
          {intakes.length === 0
            ? 'No intakes yet. Share the QR code at drop-off to see them appear here.'
            : 'No intakes match this filter.'}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {filtered.map((intake) => (
          <IntakeCard
            key={intake.id}
            intake={intake}
            openRatingId={openRatingId}
            setOpenRatingId={setOpenRatingId}
            onRate={rate}
          />
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-text-mute">
        Mechanic outcome ratings become the labeled training data that improves Greenlit's diagnostic
        accuracy over time.
      </p>
    </div>
  )
}

function UrgencyLegend() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-text-mute">
      <LegendDot color="bg-danger" label="Immediate" />
      <LegendDot color="bg-warn" label="Monitor" />
      <LegendDot color="bg-ok" label="Routine" />
      <LegendDot color="bg-text-mute/40" label="Waiting on customer" />
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} /> {label}
    </span>
  )
}

function IntakeCard({ intake, readOnly, openRatingId, setOpenRatingId, onRate }) {
  const brief = intake.brief
  const waitingOnCustomer = !brief && intake.status !== 'complete'
  const urgency = brief?.urgency || intake.urgency || 'routine'

  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`h-2.5 w-2.5 rounded-full ${waitingOnCustomer ? 'bg-text-mute/40' : URGENCY_DOT[urgency]}`}
          />
          <div>
            <p className="font-medium text-text">
              {brief?.category || intake.category || (waitingOnCustomer ? 'Waiting on customer' : 'In progress')}
              {intake.customer_name ? ` — ${intake.customer_name}` : ''}
            </p>
            <p className="text-xs text-text-dim">
              {new Date(intake.created_at).toLocaleString()}
              {brief?.urgencyLabel ? ` · ${brief.urgencyLabel}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {brief && (
            <Link
              to={`/brief/${intake.id}`}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-text/70 hover:border-brand/50"
            >
              View brief
            </Link>
          )}
          {!readOnly && (
            <>
              {intake.rating ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-ok/10 px-3 py-1.5 text-xs font-medium text-ok">
                  <CheckCircle2 size={13} /> Rated
                </span>
              ) : brief ? (
                <button
                  onClick={() => setOpenRatingId(openRatingId === intake.id ? null : intake.id)}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/20"
                >
                  <Circle size={13} /> Rate outcome
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {intake.rating && (
        <p className="mt-3 rounded-lg bg-ink/40 px-3 py-2 text-xs text-text-dim">
          Diagnosis on target: <span className="text-text/80">{intake.rating.on_target}</span>
          {intake.rating.repair_performed && (
            <>
              {' '}
              · Repair performed: <span className="text-text/80">{intake.rating.repair_performed}</span>
            </>
          )}
        </p>
      )}

      {!readOnly && openRatingId === intake.id && (
        <RatingForm onSubmit={(onTarget, repair) => onRate(intake.id, onTarget, repair)} />
      )}
    </div>
  )
}

function RatingForm({ onSubmit }) {
  const [onTarget, setOnTarget] = useState('yes')
  const [repair, setRepair] = useState('')

  return (
    <div className="mt-4 rounded-lg border border-line bg-ink/30 p-4">
      <p className="text-xs font-medium text-text-dim">Was the brief's diagnosis on target?</p>
      <div className="mt-2 flex gap-2">
        {['yes', 'partially', 'no'].map((v) => (
          <button
            key={v}
            onClick={() => setOnTarget(v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
              onTarget === v ? 'bg-brand text-ink' : 'border border-line text-text-dim'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <input
        value={repair}
        onChange={(e) => setRepair(e.target.value)}
        placeholder="What was the actual repair performed?"
        className="mt-3 w-full rounded-lg border border-line bg-panel p-2.5 text-xs text-text placeholder:text-text-mute focus:border-brand/50 focus:outline-none"
      />
      <button
        onClick={() => onSubmit(onTarget, repair)}
        className="mt-3 rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-ink hover:bg-brand-dim"
      >
        Save rating
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Kit
// ---------------------------------------------------------------------------

function KitTab({ shop, shopSlug }) {
  const qrWrapRef = useRef(null)
  const intakeUrl = `${window.location.origin}/intake?shop=${shopSlug}`

  const downloadLetterPdf = () => {
    const canvas = qrWrapRef.current?.querySelector('canvas')
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFontSize(20)
    doc.setTextColor(76, 175, 107)
    doc.text('GREENLIT', pageWidth / 2, 30, { align: 'center' })

    doc.setFontSize(14)
    doc.setTextColor(20, 20, 20)
    doc.text(shop?.name || shopSlug, pageWidth / 2, 42, { align: 'center' })
    doc.text('Scan to start your intake', pageWidth / 2, 50, { align: 'center' })

    const qrSize = 90
    doc.addImage(dataUrl, 'PNG', (pageWidth - qrSize) / 2, 65, qrSize, qrSize)

    doc.setFontSize(10)
    doc.setTextColor(120, 120, 120)
    doc.text(
      "Complete your intake before you're called up — takes about 2 minutes.",
      pageWidth / 2,
      170,
      { align: 'center' }
    )

    doc.save(`greenlit-qr-letter-${shopSlug}.pdf`)
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-2xl border border-line bg-panel p-6">
        <h2 className="font-medium text-text">Print this at your counter.</h2>
        <p className="mt-1 text-sm text-text-dim">
          Customers scan this to start their intake before you touch the car.
        </p>
        <div ref={qrWrapRef} className="mt-5 flex justify-center rounded-xl bg-white p-6">
          <QRCodeCanvas value={intakeUrl} size={200} />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={downloadLetterPdf}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-ink hover:bg-brand-dim"
          >
            <Download size={15} /> Letter PDF
          </button>
          <StubButton label="Counter card PDF" />
          <StubButton label="Table tent PDF" />
        </div>
      </div>

      <Link
        to={`/shop/${shopSlug}`}
        className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-text"
      >
        <ExternalLink size={13} /> Customer QR page (what your customers see when they scan)
      </Link>
    </div>
  )
}

function StubButton({ label }) {
  return (
    <button
      type="button"
      disabled
      title="Coming soon"
      className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-text-mute opacity-60"
    >
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

function TeamTab({ shop }) {
  const { user, shopMemberships } = useAuth()
  const [members, setMembers] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  const myRole = shopMemberships.find((m) => m.shops?.slug === shop?.slug)?.role
  const isOwner = myRole === 'owner'

  const refresh = useCallback(async () => {
    if (!shop?.id) return
    try {
      const rows = await getShopMembersWithEmail(shop.id)
      setMembers(rows)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoaded(true)
    }
  }, [shop?.id])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleRemove = async (userId) => {
    if (!shop?.id) return
    await removeShopMember(shop.id, userId)
    refresh()
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-mute">Team</h2>
        <button
          onClick={() => setInviteOpen(true)}
          className="rounded-lg bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/20"
        >
          Invite teammate
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-4 space-y-2">
        {members.map((m) => (
          <div
            key={m.user_id}
            className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3"
          >
            <div>
              <p className="text-sm text-text">{m.email}</p>
              <p className="text-xs capitalize text-text-mute">{m.role}</p>
            </div>
            {isOwner && m.user_id !== user?.id && (
              <button
                onClick={() => handleRemove(m.user_id)}
                className="inline-flex items-center gap-1 text-xs text-danger hover:underline"
              >
                <Trash2 size={13} /> Remove
              </button>
            )}
          </div>
        ))}
        {loaded && members.length === 0 && (
          <p className="text-sm text-text-dim">No team members found.</p>
        )}
      </div>

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}
    </div>
  )
}

function InviteModal({ onClose }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-text">Invite teammate</h3>
          <button onClick={onClose} className="text-text-mute hover:text-text">
            <X size={16} />
          </button>
        </div>
        {sent ? (
          <p className="mt-4 text-sm text-text-dim">
            During beta, email your teammate's address to{' '}
            <strong className="text-text">{SALES_EMAIL}</strong> and we'll add them. Self-serve
            invites coming soon.
          </p>
        ) : (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@shop.com"
              className="mt-4 w-full rounded-xl border border-line bg-ink/40 p-3 text-sm text-text focus:border-brand/50 focus:outline-none"
            />
            <button
              onClick={() => setSent(true)}
              className="mt-4 w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-ink hover:bg-brand-dim"
            >
              Send invite
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function SettingsTab({ shop }) {
  if (!shop) {
    return <p className="mt-8 text-sm text-text-dim">Loading…</p>
  }

  return (
    <div className="mt-8 max-w-md space-y-2">
      <SettingsRow label="Shop name" value={shop.name} />
      <SettingsRow label="Slug" value={shop.slug} />
      <SettingsRow label="Address" value={shop.address || '—'} />
      <SettingsRow label="Contact email" value={shop.contact_email || '—'} />
      <SettingsRow label="Contact phone" value={shop.contact_phone || '—'} />
      <SettingsRow label="Timezone" value={shop.timezone || '—'} />
      <SettingsRow label="Plan" value={shop.plan || 'Not yet assigned'} />
      <p className="pt-3 text-sm text-text-mute">To change these, contact Greenlit support.</p>
    </div>
  )
}

function SettingsRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3">
      <span className="text-xs uppercase tracking-wide text-text-mute">{label}</span>
      <span className="text-sm text-text">{value}</span>
    </div>
  )
}
