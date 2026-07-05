import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import { Download, ShieldAlert, ShieldQuestion, ShieldCheck, FileText, ArrowRight } from 'lucide-react'
import { getIntake } from '../lib/db'
import DownloadAppButton from '../components/DownloadAppButton'

const URGENCY_STYLE = {
  immediate: { icon: ShieldAlert, color: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/30' },
  monitor: { icon: ShieldQuestion, color: 'text-warn', bg: 'bg-warn/10', border: 'border-warn/30' },
  routine: { icon: ShieldCheck, color: 'text-ok', bg: 'bg-ok/10', border: 'border-ok/30' },
}

export default function BriefResult() {
  const { id } = useParams()
  const [intake, setIntake] = useState(null)
  const [brief, setBrief] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getIntake(id)
      .then((data) => {
        setIntake(data.intake)
        setBrief(data.intake.brief)
      })
      .catch((err) => setError(err.message))
  }, [id])

  if (error || !intake || !brief) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="text-text-dim">{error || "We couldn't find that brief."}</p>
        <Link to="/intake" className="mt-4 inline-block text-brand">
          Start a new intake
        </Link>
      </div>
    )
  }

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
    line(new Date(intake.created_at).toLocaleString(), 9, 8, [120, 120, 120])
    y += 2
    line(`Category: ${brief.category}`, 12, 8)
    line(`Urgency: ${brief.urgencyLabel}`, 12, 8)
    y += 4
    line('Ranked probable causes', 13, 8, [76, 175, 107])
    brief.probableCauses.forEach((c) => line(`- ${c.cause}  (${c.confidence}% confidence)`, 11, 7))
    y += 2
    line('Components to inspect first', 13, 8, [76, 175, 107])
    brief.componentsToInspect.forEach((c) => line(`- ${c}`, 11, 7))
    y += 2
    line(`Estimated repair range: $${brief.estimateRange[0]} - $${brief.estimateRange[1]}`, 11, 7)
    y += 2
    if (brief.symptomLanguage?.length) {
      line('Customer-reported context', 13, 8, [76, 175, 107])
      brief.symptomLanguage.forEach((s) => line(s, 10, 7, [90, 90, 90]))
    }
    if (intake.customer_name) {
      y += 4
      line(`Submitted by: ${intake.customer_name}`, 10, 7, [120, 120, 120])
    }
    if (brief.disclaimer) {
      y += 4
      line(brief.disclaimer, 9, 6, [120, 120, 120])
    }

    doc.save(`greenlit-brief-${intake.id}.pdf`)
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-brand">Mechanic brief ready</p>
      <h1 className="mt-2 text-3xl font-semibold text-text">{brief.category}</h1>
      <p className="mt-1 text-sm text-text-dim">
        Generated {new Date(intake.created_at).toLocaleString()}
      </p>

      <div className={`mt-6 flex items-center gap-3 rounded-xl border ${style.border} ${style.bg} px-4 py-3`}>
        <UrgencyIcon size={20} className={style.color} />
        <div>
          <p className={`font-medium ${style.color}`}>{brief.urgencyLabel}</p>
          <p className="text-xs text-text-dim">
            Estimated repair range: ${brief.estimateRange[0]}–${brief.estimateRange[1]}
          </p>
        </div>
      </div>

      <Section title="Ranked probable causes">
        <div className="space-y-3">
          {brief.probableCauses.map((c) => (
            <div key={c.cause} className="rounded-xl border border-line bg-panel p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-text">{c.cause}</span>
                <span className="text-text-dim">{c.confidence}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-brand" style={{ width: `${c.confidence}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Components to inspect first">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {brief.componentsToInspect.map((c) => (
            <li key={c} className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-text/80">
              {c}
            </li>
          ))}
        </ul>
      </Section>

      {brief.symptomLanguage?.length > 0 && (
        <Section title="Exactly what the customer reported">
          <div className="space-y-1.5 rounded-xl border border-line bg-panel p-4 text-sm text-text/70">
            {brief.symptomLanguage.map((s) => (
              <p key={s}>{s}</p>
            ))}
          </div>
        </Section>
      )}

      {brief.inputs && (
        <Section title="Attached inputs">
          <div className="flex flex-wrap gap-2 text-xs">
            <Tag active={brief.inputs.audio} label="Audio clip" />
            <Tag active={brief.inputs.video} label="Video" />
            <Tag active={brief.inputs.photo} label="Photo" />
            <Tag active={brief.inputs.text} label="Text description" />
            <Tag active label="Guided answers" />
          </div>
        </Section>
      )}

      {brief.disclaimer && (
        <p className="mt-8 text-xs text-text-mute">{brief.disclaimer}</p>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        <button
          onClick={downloadPdf}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-ink hover:bg-brand-dim"
        >
          <Download size={16} />
          Download brief as PDF
        </button>
        <Link
          to="/intake"
          className="inline-flex items-center gap-2 rounded-xl border border-line px-5 py-3 text-sm font-medium text-text/80 hover:border-brand/50"
        >
          <FileText size={16} />
          New intake
        </Link>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-panel/60 p-5">
        <p className="text-sm text-text-dim">
          Want this captured automatically next time, the moment it happens — even while your phone is locked?
        </p>
        <div className="mt-3">
          <DownloadAppButton variant="inline" />
        </div>
      </div>

      {intake.shop_id && (
        <p className="mt-6 flex items-center gap-1 text-sm text-text-dim">
          This brief has been sent ahead to the shop for your appointment.
          <ArrowRight size={14} />
        </p>
      )}
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

function Tag({ active, label }) {
  return (
    <span
      className={`rounded-full px-3 py-1.5 ${
        active ? 'bg-brand-soft text-brand border border-brand/30' : 'bg-panel text-text-mute border border-line'
      }`}
    >
      {label}
    </span>
  )
}
