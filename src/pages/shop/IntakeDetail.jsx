import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import {
  Download,
  Flag,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Trash2,
  X,
} from 'lucide-react'
import { archiveIntake, flagIntake, getIntake, saveRating, unflagIntake } from '../../lib/db'
import RatingForm from '../../components/shop/RatingForm'
import { relativeTime, vehicleLabel } from '../../lib/shop/intakeDisplay'

const URGENCY_STYLE = {
  immediate: { icon: ShieldAlert, color: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/30' },
  monitor: { icon: ShieldQuestion, color: 'text-warn', bg: 'bg-warn/10', border: 'border-warn/30' },
  routine: { icon: ShieldCheck, color: 'text-ok', bg: 'bg-ok/10', border: 'border-ok/30' },
}

const FLAG_REASONS = ['Inappropriate', 'Test/spam', 'Duplicate', 'Other']

export default function IntakeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { intakes, refresh, slug } = useOutletContext()

  const intake = intakes.find((i) => i.id === id)

  const [bundle, setBundle] = useState(null)
  const [bundleError, setBundleError] = useState(null)
  const [flagModalOpen, setFlagModalOpen] = useState(false)
  const [trashConfirmOpen, setTrashConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [rawOpen, setRawOpen] = useState(false)

  useEffect(() => {
    setBundle(null)
    setBundleError(null)
    getIntake(id)
      .then(setBundle)
      .catch((err) => setBundleError(err.message))
  }, [id])

  if (!intake) {
    return <p className="text-sm text-text-dim">Intake not found.</p>
  }

  const brief = intake.brief
  const urgency = brief?.urgency || intake.urgency || 'routine'
  const style = URGENCY_STYLE[urgency] || URGENCY_STYLE.routine
  const UrgencyIcon = style.icon

  const handleFlag = async (reason) => {
    setBusy(true)
    try {
      await flagIntake(id, reason)
      await refresh()
      setFlagModalOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const handleUnflag = async () => {
    setBusy(true)
    try {
      await unflagIntake(id)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const handleTrash = async () => {
    setBusy(true)
    try {
      await archiveIntake(id)
      await refresh()
      setTrashConfirmOpen(false)
      navigate(`/shop/${slug}/intakes`)
    } finally {
      setBusy(false)
    }
  }

  const handleRate = async (onTarget, repairPerformed) => {
    await saveRating(id, { onTarget, repairPerformed })
    await refresh()
  }

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
    if (brief?.category) line(`Category: ${brief.category}`, 12, 8)
    if (brief?.urgencyLabel) line(`Urgency: ${brief.urgencyLabel}`, 12, 8)
    y += 4
    if (brief?.probableCauses?.length) {
      line('Ranked probable causes', 13, 8, [76, 175, 107])
      brief.probableCauses.forEach((c) => line(`- ${c.cause}  (${c.confidence}% confidence)`, 11, 7))
      y += 2
    }
    if (brief?.componentsToInspect?.length) {
      line('Components to inspect first', 13, 8, [76, 175, 107])
      brief.componentsToInspect.forEach((c) => line(`- ${c}`, 11, 7))
      y += 2
    }
    if (brief?.estimateRange) {
      line(`Estimated repair range: $${brief.estimateRange[0]} - $${brief.estimateRange[1]}`, 11, 7)
    }

    doc.save(`greenlit-brief-${id}.pdf`)
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-text">{vehicleLabel(intake)}</h2>
          <p className="mt-1 text-sm text-text-dim">
            Submitted {relativeTime(intake.created_at)}
            {intake.flagged && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                <Flag size={11} /> Flagged
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadPdf}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-text hover:border-brand/50"
          >
            <Download size={13} /> Print / share
          </button>
          {intake.flagged ? (
            <button
              onClick={handleUnflag}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-text hover:border-brand/50"
            >
              <Flag size={13} /> Unflag
            </button>
          ) : (
            <button
              onClick={() => setFlagModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-text hover:border-brand/50"
            >
              <Flag size={13} /> Flag
            </button>
          )}
          <button
            onClick={() => setTrashConfirmOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-danger hover:border-danger/50"
          >
            <Trash2 size={13} /> Trash
          </button>
        </div>
      </div>

      {brief?.urgencyLabel && (
        <div className={`mt-6 flex items-center gap-3 rounded-xl border ${style.border} ${style.bg} px-4 py-3`}>
          <UrgencyIcon size={20} className={style.color} />
          <div>
            <p className={`font-medium ${style.color}`}>Urgency: {brief.urgencyLabel}</p>
            {brief.estimateRange && (
              <p className="text-xs text-text-dim">
                Estimated repair range: ${brief.estimateRange[0]}–${brief.estimateRange[1]}
              </p>
            )}
          </div>
        </div>
      )}

      {brief?.symptomLanguage?.length > 0 && (
        <Section title="Customer's exact words">
          <div className="space-y-1.5 rounded-xl border border-line bg-ink/40 p-4 font-mono text-sm text-text/80">
            {brief.symptomLanguage.map((s) => (
              <p key={s}>“{s}”</p>
            ))}
          </div>
        </Section>
      )}

      <Section title="Raw inputs">
        <button
          onClick={() => setRawOpen((v) => !v)}
          className="text-sm text-brand hover:underline"
        >
          {rawOpen ? 'Hide' : 'Show'} audio, photos, video, and guided answers
        </button>
        {rawOpen && (
          <div className="mt-3">
            {bundleError && (
              <p className="text-sm text-text-dim">Raw inputs unavailable for this intake.</p>
            )}
            {bundle && <RawInputs bundle={bundle} />}
          </div>
        )}
      </Section>

      {brief?.probableCauses?.length > 0 && (
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
      )}

      {brief?.componentsToInspect?.length > 0 && (
        <Section title="Components to inspect first">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {brief.componentsToInspect.map((c) => (
              <li key={c} className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-text/80">
                {c}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Outcome">
        {intake.rating ? (
          <p className="rounded-lg bg-ink/40 px-3 py-2 text-sm text-text-dim">
            Diagnosis on target: <span className="text-text/80">{intake.rating.on_target}</span>
            {intake.rating.repair_performed && (
              <>
                {' '}
                · Repair performed: <span className="text-text/80">{intake.rating.repair_performed}</span>
              </>
            )}
          </p>
        ) : brief ? (
          <RatingForm onSubmit={handleRate} />
        ) : (
          <p className="text-sm text-text-dim">No brief yet — waiting on the customer.</p>
        )}
      </Section>

      {flagModalOpen && (
        <FlagModal onClose={() => setFlagModalOpen(false)} onSubmit={handleFlag} busy={busy} />
      )}
      {trashConfirmOpen && (
        <ConfirmModal
          title="Trash this intake?"
          body="It will disappear from Overview and the default Intakes view, but stays in the database and can be restored from the Archived filter."
          onCancel={() => setTrashConfirmOpen(false)}
          onConfirm={handleTrash}
          busy={busy}
        />
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mt-8">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-mute">{title}</h3>
      {children}
    </div>
  )
}

function RawInputs({ bundle }) {
  const media = bundle.media ?? []
  const messages = bundle.messages ?? []
  const qa = messages.filter((m) => m.role === 'user' || m.role === 'interviewer')

  return (
    <div className="space-y-4">
      {media.length > 0 && (
        <div className="space-y-3">
          {media.map((m) => (
            <MediaItem key={m.id} media={m} />
          ))}
        </div>
      )}
      {qa.length > 0 && (
        <div className="space-y-2 rounded-xl border border-line bg-panel p-4 text-sm">
          {qa.map((m) => (
            <p key={m.id} className="text-text-dim">
              <span className="font-medium capitalize text-text/70">{m.role}: </span>
              {typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}
            </p>
          ))}
        </div>
      )}
      {media.length === 0 && qa.length === 0 && (
        <p className="text-sm text-text-dim">No raw inputs recorded.</p>
      )}
    </div>
  )
}

function MediaItem({ media }) {
  if (media.kind === 'text') {
    return (
      <p className="rounded-lg border border-line bg-panel p-3 text-sm text-text/80">
        {media.text_content}
      </p>
    )
  }
  if (!media.signed_url) {
    return <p className="text-xs text-text-mute">{media.kind} attachment unavailable</p>
  }
  if (media.kind === 'audio') return <audio controls src={media.signed_url} className="w-full" />
  if (media.kind === 'video') return <video controls src={media.signed_url} className="w-full rounded-lg" />
  if (media.kind === 'photo') return <img src={media.signed_url} alt="" className="max-w-xs rounded-lg" />
  return null
}

function FlagModal({ onClose, onSubmit, busy }) {
  const [reason, setReason] = useState(FLAG_REASONS[0])
  const [customReason, setCustomReason] = useState('')

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
          <h3 className="font-medium text-text">Flag this intake</h3>
          <button onClick={onClose} className="text-text-mute hover:text-text">
            <X size={16} />
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {FLAG_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm text-text">
              <input type="radio" checked={reason === r} onChange={() => setReason(r)} />
              {r}
            </label>
          ))}
        </div>
        {reason === 'Other' && (
          <input
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Describe the reason"
            className="mt-3 w-full rounded-lg border border-line bg-ink/40 p-2.5 text-sm text-text focus:border-brand/50 focus:outline-none"
          />
        )}
        <button
          onClick={() => onSubmit(reason === 'Other' ? customReason : reason)}
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-ink hover:bg-brand-dim disabled:opacity-50"
        >
          Flag intake
        </button>
      </div>
    </div>
  )
}

function ConfirmModal({ title, body, onCancel, onConfirm, busy }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-medium text-text">{title}</h3>
        <p className="mt-2 text-sm text-text-dim">{body}</p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium text-text"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-xl bg-danger py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
          >
            Trash
          </button>
        </div>
      </div>
    </div>
  )
}
