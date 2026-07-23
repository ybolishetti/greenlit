import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Download, Loader2 } from 'lucide-react'
import { getConsumerIntake } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import UrgencyBanner from '../components/brief/UrgencyBanner'
import VehicleLine from '../components/brief/VehicleLine'
import CustomerVerbatim from '../components/brief/CustomerVerbatim'
import ProbableCauses from '../components/brief/ProbableCauses'
import InspectionTargets from '../components/brief/InspectionTargets'
import DisclaimerFooter from '../components/brief/DisclaimerFooter'
import { buildBriefPdf } from '../lib/brief/pdf'

export default function AccountBrief() {
  const { id } = useParams()
  const { isSignedIn, loading: authLoading } = useAuth()
  const [intake, setIntake] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pdfBusy, setPdfBusy] = useState(false)

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

  const downloadPdf = async () => {
    setPdfBusy(true)
    try {
      await buildBriefPdf({ brief, intake, media: [], filename: `greenlit-brief-${id}.pdf` })
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link to="/account" className="text-sm text-text-dim hover:text-brand">
        ← My intakes
      </Link>

      <p className="mt-6 text-sm font-medium uppercase tracking-wide text-brand">Saved brief</p>

      {brief.category && (
        <>
          <h1 className="mt-2 text-3xl font-semibold text-text">{brief.category}</h1>
          <p className="mt-1 text-sm text-text-dim">
            Saved {new Date(intake.completed_at ?? intake.created_at).toLocaleString()}
          </p>
        </>
      )}

      <UrgencyBanner urgency={brief.urgency} urgencyLabel={brief.urgencyLabel} estimateRange={brief.estimateRange} />
      <VehicleLine vehicle={intake.vehicle} />
      <CustomerVerbatim symptomLanguage={brief.symptomLanguage} />
      <ProbableCauses probableCauses={brief.probableCauses} />
      <InspectionTargets componentsToInspect={brief.componentsToInspect} />
      <DisclaimerFooter disclaimer={brief.disclaimer} />

      <div className="mt-10">
        <button
          type="button"
          onClick={downloadPdf}
          disabled={pdfBusy}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-ink hover:bg-brand-dim disabled:opacity-60"
        >
          {pdfBusy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {pdfBusy ? 'Preparing PDF…' : 'Download brief as PDF'}
        </button>
      </div>
    </div>
  )
}
