import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { Download, Flag, Trash2, X } from 'lucide-react'
import { archiveIntake, flagIntake, getIntake, saveRating, unflagIntake } from '../../lib/db'
import RatingForm from '../../components/shop/RatingForm'
import { relativeTime, vehicleLabel } from '../../lib/shop/intakeDisplay'
import UrgencyBanner from '../../components/brief/UrgencyBanner'
import CustomerVerbatim from '../../components/brief/CustomerVerbatim'
import ProbableCauses from '../../components/brief/ProbableCauses'
import InspectionTargets from '../../components/brief/InspectionTargets'
import RawEvidence from '../../components/brief/RawEvidence'
import { buildBriefPdf } from '../../lib/brief/pdf'

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
  const [pdfBusy, setPdfBusy] = useState(false)

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
  const guidedAnswers = (bundle?.messages ?? []).filter((m) => m.role === 'user' || m.role === 'interviewer')

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

  const downloadPdf = async () => {
    if (!brief) return
    setPdfBusy(true)
    try {
      await buildBriefPdf({ brief, intake, media: bundle?.media ?? [], filename: `greenlit-brief-${id}.pdf` })
    } finally {
      setPdfBusy(false)
    }
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
            disabled={pdfBusy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-text hover:border-brand/50 disabled:opacity-60"
          >
            <Download size={13} /> {pdfBusy ? 'Preparing…' : 'Print / share'}
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

      <UrgencyBanner urgency={urgency} urgencyLabel={brief?.urgencyLabel} estimateRange={brief?.estimateRange} />
      <CustomerVerbatim symptomLanguage={brief?.symptomLanguage} />
      <ProbableCauses probableCauses={brief?.probableCauses} />
      <InspectionTargets componentsToInspect={brief?.componentsToInspect} />
      {bundleError ? (
        <p className="mt-8 text-sm text-text-dim">Raw evidence unavailable for this intake.</p>
      ) : (
        <RawEvidence media={bundle?.media} />
      )}

      {guidedAnswers.length > 0 && (
        <Section title="Guided answers">
          <div className="space-y-2 rounded-xl border border-line bg-panel p-4 text-sm">
            {guidedAnswers.map((m) => (
              <p key={m.id} className="text-text-dim">
                <span className="font-medium capitalize text-text/70">{m.role}: </span>
                {typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}
              </p>
            ))}
          </div>
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
