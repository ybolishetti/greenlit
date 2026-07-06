import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import { Download, Loader2, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react'
import { getConsumerIntake } from '../lib/db'
import { useAuth } from '../context/AuthContext'

const URGENCY_STYLE = {
  immediate: { icon: ShieldAlert, color: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/30' },
  monitor: { icon: ShieldQuestion, color: 'text-warn', bg: 'bg-warn/10', border: 'border-warn/30' },
  routine: { icon: ShieldCheck, color: 'text-ok', bg: 'bg-ok/10', border: 'border-ok/30' },
}

export default function AccountBrief() {
  const { id } = useParams()
  const { isSignedIn, loading: authLoading } = useAuth()
  const [intake, setIntake] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (authLoading) return
    if (!isSignedIn) {
      setLoading(false)
      return
    }
    getConsumerIntake(id)
      .then((row) => {
        if (!row) throw new Error('Intake not found')
        setIntake(row)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, isSignedIn, authLoading])

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-text-dim">
        <Loader2 className="mr-2 animate-spin" size={18} /> Loading brief…
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="text-text-dim">Sign in to view this brief.</p>
        <Link to="/account" className="mt-4 inline-block text-brand">
          My intakes
        </Link>
      </div>
    )
  }

  if (error || !intake?.brief) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="text-text-dim">{error ?? 'Brief not found'}</p>
        <Link to="/account" className="mt-4 inline-block text-brand">
          Back to my intakes
        </Link>
      </div>
    )
  }

  const brief = intake.brief
  const style = URGENCY_STYLE[brief.urgency] || URGENCY_STYLE.routine
  const UrgencyIcon = style.icon

  const downloadPdf = () => {
    const doc = new jsPDF()
    let y = 20
    const line = (text, size = 11, gap = 7, color = [20, 20, 20]) => {
      doc.setFontSize(size)
      doc.setTextColor(...color)
      const wrapped = doc.splitTextToSize(text, 170)
      doc.text(wrapped, 20, y)
      y += gap * wrapped.length
    }

    line('GREENLIT — Mechanic Brief', 18, 10, [76, 175, 107])
    if (intake.created_at) {
      line(new Date(intake.created_at).toLocaleString(), 9, 8, [120, 120, 120])
    }
    y += 2
    line(`Category: ${brief.category}`, 12, 8)
    if (brief.urgencyLabel) line(`Urgency: ${brief.urgencyLabel}`, 12, 8)
    y += 4
    if (brief.probableCauses?.length) {
      line('Ranked probable causes', 13, 8, [76, 175, 107])
      brief.probableCauses.forEach((c) => line(`- ${c.cause}  (${c.confidence}% confidence)`, 11, 7))
    }
    if (brief.disclaimer) {
      y += 4
      line(brief.disclaimer, 9, 6, [120, 120, 120])
    }
    doc.save(`greenlit-brief-${id}.pdf`)
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link to="/account" className="text-sm text-text-dim hover:text-brand">
        ← My intakes
      </Link>

      <p className="mt-6 text-sm font-medium uppercase tracking-wide text-brand">Saved brief</p>

      {intake.vehicle && (
        <p className="mt-2 text-xs text-text-mute">
          {intake.vehicle.year} {intake.vehicle.make} {intake.vehicle.model}
          {intake.vehicle.mileage != null ? ` · ${intake.vehicle.mileage.toLocaleString()} mi` : ''}
        </p>
      )}

      {brief.category && (
        <>
          <h1 className="mt-2 text-3xl font-semibold text-text">{brief.category}</h1>
          <p className="mt-1 text-sm text-text-dim">
            Saved {new Date(intake.completed_at ?? intake.created_at).toLocaleString()}
          </p>
        </>
      )}

      {brief.urgency && brief.urgencyLabel && brief.estimateRange && (
        <div className={`mt-6 flex items-center gap-3 rounded-xl border ${style.border} ${style.bg} px-4 py-3`}>
          <UrgencyIcon size={20} className={style.color} />
          <div>
            <p className={`font-medium ${style.color}`}>{brief.urgencyLabel}</p>
            <p className="text-xs text-text-dim">
              Estimated repair range: ${brief.estimateRange[0]}–${brief.estimateRange[1]}
            </p>
          </div>
        </div>
      )}

      {brief.probableCauses?.length > 0 && (
        <Section title="Ranked probable causes">
          <div className="space-y-3">
            {brief.probableCauses.map((c) => (
              <div key={c.cause} className="rounded-xl border border-line bg-panel p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-text">{c.cause}</span>
                  <span className="text-text-dim">{c.confidence}%</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="mt-10">
        <button
          type="button"
          onClick={downloadPdf}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-ink hover:bg-brand-dim"
        >
          <Download size={16} />
          Download brief as PDF
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-mute">{title}</h2>
      {children}
    </div>
  )
}
