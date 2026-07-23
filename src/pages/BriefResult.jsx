import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { Download, FileText, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import { getIntake, saveConsumerIntake } from '../lib/db'
import { runDiagnosticianFinalStream } from '../lib/ai/client'
import DownloadAppButton from '../components/DownloadAppButton'
import { useAuth } from '../context/AuthContext'
import { useStartIntake } from '../hooks/useIntakeAccess'
import { getOrCreateDeviceId, markIntakeSessionUsed, setPendingClaim } from '../lib/deviceId'
import UrgencyBanner from '../components/brief/UrgencyBanner'
import VehicleLine from '../components/brief/VehicleLine'
import CustomerVerbatim from '../components/brief/CustomerVerbatim'
import ProbableCauses from '../components/brief/ProbableCauses'
import InspectionTargets from '../components/brief/InspectionTargets'
import RawEvidence from '../components/brief/RawEvidence'
import DisclaimerFooter from '../components/brief/DisclaimerFooter'
import { buildBriefPdf } from '../lib/brief/pdf'

export default function BriefResult() {
  const { id } = useParams()
  const location = useLocation()
  const generatingRef = useRef(false)
  const persistedRef = useRef(false)
  const { isSignedIn, openAuthModal } = useAuth()
  const startIntake = useStartIntake()

  const [intake, setIntake] = useState(null)
  const [brief, setBrief] = useState(null)
  const [media, setMedia] = useState([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [consumerIntakeId, setConsumerIntakeId] = useState(null)
  const [savedToAccount, setSavedToAccount] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)

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
          setMedia(data.media ?? [])
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
        setMedia(data.media ?? [])
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

  const downloadPdf = async () => {
    setPdfBusy(true)
    try {
      await buildBriefPdf({ brief, intake, media, filename: `greenlit-brief-${id}.pdf` })
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {generating && (
        <p className="mb-4 flex items-center gap-2 text-sm text-text-dim">
          <Loader2 size={14} className="animate-spin" /> Building your brief…
        </p>
      )}

      <p className="text-sm font-medium uppercase tracking-wide text-brand">Mechanic brief ready</p>

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

      <UrgencyBanner urgency={brief.urgency} urgencyLabel={brief.urgencyLabel} estimateRange={brief.estimateRange} />
      <VehicleLine vehicle={intake?.vehicle} />
      <CustomerVerbatim symptomLanguage={brief.symptomLanguage} />
      <ProbableCauses probableCauses={brief.probableCauses} />
      <InspectionTargets componentsToInspect={brief.componentsToInspect} />
      <RawEvidence media={media} />
      <DisclaimerFooter disclaimer={brief.disclaimer} />

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
            disabled={pdfBusy}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-ink hover:bg-brand-dim disabled:opacity-60"
          >
            {pdfBusy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {pdfBusy ? 'Preparing PDF…' : 'Download brief as PDF'}
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
