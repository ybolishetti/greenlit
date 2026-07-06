import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import { Download, ShieldAlert, ShieldQuestion, ShieldCheck, FileText, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import { getIntake, saveConsumerIntake } from '../lib/db'
import { runDiagnosticianFinalStream } from '../lib/ai/client'
import DownloadAppButton from '../components/DownloadAppButton'
import { useAuth } from '../context/AuthContext'
import { useStartIntake } from '../hooks/useIntakeAccess'
import { getOrCreateDeviceId, markIntakeSessionUsed, setPendingClaim } from '../lib/deviceId'

const URGENCY_STYLE = {
  immediate: { icon: ShieldAlert, color: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/30' },
  monitor: { icon: ShieldQuestion, color: 'text-warn', bg: 'bg-warn/10', border: 'border-warn/30' },
  routine: { icon: ShieldCheck, color: 'text-ok', bg: 'bg-ok/10', border: 'border-ok/30' },
}

export default function BriefResult() {
  const { id } = useParams()
  const location = useLocation()
  const generatingRef = useRef(false)
  const persistedRef = useRef(false)
  const { isSignedIn, openAuthModal } = useAuth()
  const startIntake = useStartIntake()

  const [intake, setIntake] = useState(null)
  const [brief, setBrief] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [consumerIntakeId, setConsumerIntakeId] = useState(null)
  const [savedToAccount, setSavedToAccount] = useState(false)

  const consumerStorageKey = `greenlit_consumer_intake_${id}`
  const savedStorageKey = `greenlit_saved_${id}`

  useEffect(() => {
    const storedId = sessionStorage.getItem(consumerStorageKey)
    if (storedId) {
      setConsumerIntakeId(storedId)
      if (sessionStorage.getItem(`greenlit_claimed_${storedId}`) === '1') {
        setSavedToAccount(true)
      }
    }
    if (sessionStorage.getItem(savedStorageKey) === '1') setSavedToAccount(true)
  }, [consumerStorageKey, savedStorageKey])

  const persistConsumerIntake = async (data, briefData) => {
    if (persistedRef.current || !data?.intake?.vehicle) return

    const existingId = sessionStorage.getItem(consumerStorageKey)
    if (existingId) {
      setConsumerIntakeId(existingId)
      persistedRef.current = true
      return
    }

    persistedRef.current = true

    const inputs = {
      operational_intake_id: id,
      media: (data.media ?? []).map((m) => ({
        kind: m.kind,
        id: m.id,
        text_content: m.text_content ?? undefined,
      })),
      guided_answers: (data.messages ?? [])
        .filter((m) => m.role === 'user')
        .map((m) => m.content),
      brief_inputs: briefData?.inputs ?? null,
    }

    try {
      const row = await saveConsumerIntake({
        vehicle: data.intake.vehicle,
        inputs,
        brief: briefData,
        status: 'complete',
      })
      setConsumerIntakeId(row.id)
      sessionStorage.setItem(consumerStorageKey, row.id)
      if (isSignedIn) {
        setSavedToAccount(true)
        sessionStorage.setItem(savedStorageKey, '1')
      } else {
        markIntakeSessionUsed()
      }
    } catch (err) {
      console.error('Failed to persist consumer intake:', err)
      persistedRef.current = false
    }
  }

  useEffect(() => {
    const generatePayload = location.state?.generate ? location.state.payload : null

    if (generatePayload && !generatingRef.current) {
      generatingRef.current = true
      setGenerating(true)
      setError(null)

      runDiagnosticianFinalStream(id, generatePayload, (partial) => {
        setBrief((prev) => ({ ...(prev ?? {}), ...partial }))
      })
        .then(async () => {
          const data = await getIntake(id)
          setIntake(data.intake)
          setBrief(data.intake.brief)
          setGenerating(false)
          await persistConsumerIntake(data, data.intake.brief)
        })
        .catch((err) => {
          setError(err.message || 'Failed to generate brief')
          setGenerating(false)
        })
      return
    }

    getIntake(id)
      .then(async (data) => {
        setIntake(data.intake)
        setBrief(data.intake.brief)
        if (data.intake.status === 'complete' && data.intake.brief) {
          await persistConsumerIntake(data, data.intake.brief)
        }
      })
      .catch((err) => setError(err.message))
  }, [id, location.state])

  const handleSaveToAccount = () => {
    if (!consumerIntakeId) return
    const deviceId = getOrCreateDeviceId()
    openAuthModal({
      mode: 'claim',
      disableSkip: true,
      onBeforeOAuth: () => {
        setPendingClaim({ deviceId, intakeId: consumerIntakeId })
      },
      onClaimSuccess: () => {
        setSavedToAccount(true)
        sessionStorage.setItem(savedStorageKey, '1')
      },
    })
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="text-text-dim">{error}</p>
        <Link to="/intake" className="mt-4 inline-block text-brand">
          Start a new intake
        </Link>
      </div>
    )
  }

  if (!brief) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center text-text-dim">
        <Loader2 className="mx-auto mb-3 animate-spin" size={24} />
        <p>Generating your mechanic brief…</p>
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
    if (intake?.created_at) {
      line(new Date(intake.created_at).toLocaleString(), 9, 8, [120, 120, 120])
    }
    y += 2
    line(`Category: ${brief.category}`, 12, 8)
    if (brief.urgencyLabel) line(`Urgency: ${brief.urgencyLabel}`, 12, 8)
    y += 4
    if (brief.probableCauses?.length) {
      line('Ranked probable causes', 13, 8, [76, 175, 107])
      brief.probableCauses.forEach((c) => line(`- ${c.cause}  (${c.confidence}% confidence)`, 11, 7))
      y += 2
    }
    if (brief.componentsToInspect?.length) {
      line('Components to inspect first', 13, 8, [76, 175, 107])
      brief.componentsToInspect.forEach((c) => line(`- ${c}`, 11, 7))
      y += 2
    }
    if (brief.estimateRange) {
      line(`Estimated repair range: $${brief.estimateRange[0]} - $${brief.estimateRange[1]}`, 11, 7)
      y += 2
    }
    if (brief.symptomLanguage?.length) {
      line('Customer-reported context', 13, 8, [76, 175, 107])
      brief.symptomLanguage.forEach((s) => line(s, 10, 7, [90, 90, 90]))
    }
    if (intake?.customer_name) {
      y += 4
      line(`Submitted by: ${intake.customer_name}`, 10, 7, [120, 120, 120])
    }
    if (brief.disclaimer) {
      y += 4
      line(brief.disclaimer, 9, 6, [120, 120, 120])
    }

    doc.save(`greenlit-brief-${id}.pdf`)
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {generating && (
        <p className="mb-4 flex items-center gap-2 text-sm text-text-dim">
          <Loader2 size={14} className="animate-spin" /> Building your brief…
        </p>
      )}

      <p className="text-sm font-medium uppercase tracking-wide text-brand">Mechanic brief ready</p>

      {intake?.vehicle && (
        <p className="mt-2 text-xs text-text-mute">
          {intake.vehicle.year} {intake.vehicle.make} {intake.vehicle.model}
          {intake.vehicle.mileage != null ? ` · ${intake.vehicle.mileage.toLocaleString()} mi` : ''}
        </p>
      )}

      {brief.category && (
        <>
          <h1 className="mt-2 text-3xl font-semibold text-text">{brief.category}</h1>
          {intake?.created_at && (
            <p className="mt-1 text-sm text-text-dim">
              Generated {new Date(intake.created_at).toLocaleString()}
            </p>
          )}
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
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${c.confidence}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {brief.componentsToInspect?.length > 0 && (
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

      {!generating && !isSignedIn && !savedToAccount && consumerIntakeId && (
        <div className="mt-10 rounded-2xl border border-brand/30 bg-brand-soft p-5">
          <h2 className="text-lg font-semibold text-text">Save this brief to your account</h2>
          <p className="mt-1 text-sm text-text-dim">
            Keep this brief across devices and access it from My intakes anytime.
          </p>
          <button
            type="button"
            onClick={handleSaveToAccount}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-ink hover:bg-brand-dim"
          >
            Save this brief to your account
          </button>
          <p className="mt-3 text-xs text-text-mute">
            You can also download the brief PDF to save it locally.
          </p>
        </div>
      )}

      {!generating && savedToAccount && (
        <div className="mt-10 flex items-center gap-2 rounded-xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm text-brand">
          <CheckCircle2 size={16} />
          Saved to your account
          <Link to="/account" className="ml-auto text-brand hover:underline">
            View my intakes
          </Link>
        </div>
      )}

      {!generating && (
        <div className="mt-10 flex flex-wrap gap-3">
          <button
            onClick={downloadPdf}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-ink hover:bg-brand-dim"
          >
            <Download size={16} />
            Download brief as PDF
          </button>
          <button
            type="button"
            onClick={startIntake}
            className="inline-flex items-center gap-2 rounded-xl border border-line px-5 py-3 text-sm font-medium text-text/80 hover:border-brand/50"
          >
            <FileText size={16} />
            New intake
          </button>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-line bg-panel/60 p-5">
        <p className="text-sm text-text-dim">
          Want this captured automatically next time, the moment it happens — even while your phone is locked?
        </p>
        <div className="mt-3">
          <DownloadAppButton variant="inline" />
        </div>
      </div>

      {intake?.shop_id && (
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
