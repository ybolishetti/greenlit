import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { CheckCircle2, Circle, ExternalLink, LogOut } from 'lucide-react'
import AuthGate from '../components/AuthGate'
import { listShopIntakes, saveRating, signOut } from '../lib/db'

const URGENCY_DOT = {
  immediate: 'bg-danger',
  monitor: 'bg-warn',
  routine: 'bg-ok',
}

export default function ShopDashboard() {
  const { shopId: shopSlug } = useParams()

  return (
    <AuthGate shopSlug={shopSlug}>
      {({ session }) => <DashboardInner shopSlug={shopSlug} session={session} />}
    </AuthGate>
  )
}

function DashboardInner({ shopSlug, session }) {
  const [intakes, setIntakes] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [openRatingId, setOpenRatingId] = useState(null)

  const refresh = useCallback(async () => {
    const rows = await listShopIntakes(shopSlug)
    setIntakes(rows)
    setLoaded(true)
  }, [shopSlug])

  useEffect(() => {
    refresh()
  }, [refresh])

  const rate = async (id, onTarget, repairPerformed) => {
    await saveRating(id, { onTarget, repairPerformed })
    refresh()
    setOpenRatingId(null)
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-brand">Shop dashboard</p>
          <h1 className="mt-1 text-2xl font-semibold text-text">Incoming intakes</h1>
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

      {loaded && intakes.length === 0 && (
        <p className="mt-10 text-center text-text-dim">
          No intakes yet. Share the QR code at drop-off to see them appear here.
        </p>
      )}

      <div className="mt-8 space-y-3">
        {intakes.map((intake) => {
          const brief = intake.brief
          const urgency = brief?.urgency || intake.urgency || 'routine'
          return (
            <div key={intake.id} className="rounded-xl border border-line bg-panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${URGENCY_DOT[urgency]}`} />
                  <div>
                    <p className="font-medium text-text">
                      {brief?.category || intake.category || 'In progress'}
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
                </div>
              </div>

              {intake.rating && (
                <p className="mt-3 rounded-lg bg-ink/40 px-3 py-2 text-xs text-text-dim">
                  Diagnosis on target: <span className="text-text/80">{intake.rating.on_target}</span>
                  {intake.rating.repair_performed && (
                    <>
                      {' '}
                      · Repair performed:{' '}
                      <span className="text-text/80">{intake.rating.repair_performed}</span>
                    </>
                  )}
                </p>
              )}

              {openRatingId === intake.id && (
                <RatingForm onSubmit={(onTarget, repair) => rate(intake.id, onTarget, repair)} />
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-10 text-center text-xs text-text-mute">
        Mechanic outcome ratings become the labeled training data that improves Greenlit's diagnostic
        accuracy over time.
      </p>
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
