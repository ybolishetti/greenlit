import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { CheckCircle2, Circle, ExternalLink } from 'lucide-react'
import { listIntakes, seedDemoData, updateIntake } from '../lib/storage'
import { generateBrief } from '../lib/mockDiagnosis'

const URGENCY_DOT = {
  immediate: 'bg-danger',
  monitor: 'bg-warn',
  routine: 'bg-ok',
}

export default function ShopDashboard() {
  const { shopId } = useParams()
  const [intakes, setIntakes] = useState([])
  const [openRatingId, setOpenRatingId] = useState(null)

  const refresh = () => setIntakes(listIntakes({ shopId }))

  useEffect(() => {
    if (shopId === 'demo-shop') seedDemoData()
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId])

  const rate = (id, onTarget, repairPerformed) => {
    updateIntake(id, { status: 'rated', rating: { onTarget, repairPerformed } })
    refresh()
    setOpenRatingId(null)
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-lime">Shop dashboard</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Incoming intakes</h1>
        </div>
        <Link
          to={`/shop/${shopId}`}
          className="inline-flex items-center gap-1 text-sm text-white/50 hover:text-white"
        >
          View QR page <ExternalLink size={13} />
        </Link>
      </div>

      {intakes.length === 0 && (
        <p className="mt-10 text-center text-white/40">
          No intakes yet. Share the QR code at drop-off to see them appear here.
        </p>
      )}

      <div className="mt-8 space-y-3">
        {intakes.map((intake) => {
          const brief = generateBrief(intake)
          return (
            <div key={intake.id} className="rounded-xl border border-line bg-panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${URGENCY_DOT[brief.urgency]}`} />
                  <div>
                    <p className="font-medium text-white">
                      {brief.category}
                      {intake.customerName ? ` — ${intake.customerName}` : ''}
                    </p>
                    <p className="text-xs text-white/40">
                      {new Date(intake.createdAt).toLocaleString()} · {brief.urgencyLabel}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/brief/${intake.id}`}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-white/70 hover:border-lime/50 hover:text-white"
                  >
                    View brief
                  </Link>
                  {intake.status === 'rated' ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-ok/10 px-3 py-1.5 text-xs font-medium text-ok">
                      <CheckCircle2 size={13} /> Rated
                    </span>
                  ) : (
                    <button
                      onClick={() => setOpenRatingId(openRatingId === intake.id ? null : intake.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-lime/10 px-3 py-1.5 text-xs font-medium text-lime hover:bg-lime/20"
                    >
                      <Circle size={13} /> Rate outcome
                    </button>
                  )}
                </div>
              </div>

              {intake.status === 'rated' && (
                <p className="mt-3 rounded-lg bg-ink/40 px-3 py-2 text-xs text-white/50">
                  Diagnosis on target: <span className="text-white/80">{intake.rating.onTarget}</span>
                  {intake.rating.repairPerformed && (
                    <> · Repair performed: <span className="text-white/80">{intake.rating.repairPerformed}</span></>
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

      <p className="mt-10 text-center text-xs text-white/30">
        Mechanic outcome ratings become the labeled training data that improves
        Greenlit's diagnostic accuracy over time.
      </p>
    </div>
  )
}

function RatingForm({ onSubmit }) {
  const [onTarget, setOnTarget] = useState('yes')
  const [repair, setRepair] = useState('')

  return (
    <div className="mt-4 rounded-lg border border-line bg-ink/30 p-4">
      <p className="text-xs font-medium text-white/60">Was the brief's diagnosis on target?</p>
      <div className="mt-2 flex gap-2">
        {['yes', 'partially', 'no'].map((v) => (
          <button
            key={v}
            onClick={() => setOnTarget(v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
              onTarget === v ? 'bg-lime text-ink' : 'border border-line text-white/60'
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
        className="mt-3 w-full rounded-lg border border-line bg-panel p-2.5 text-xs text-white placeholder:text-white/30 focus:border-lime/50 focus:outline-none"
      />
      <button
        onClick={() => onSubmit(onTarget, repair)}
        className="mt-3 rounded-lg bg-lime px-4 py-1.5 text-xs font-semibold text-ink hover:bg-lime-dim"
      >
        Save rating
      </button>
    </div>
  )
}
