import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Loader2 } from 'lucide-react'
import VehicleForm from '../../components/intake/VehicleForm'
import InputPicker from '../../components/InputPicker'
import AudioRecorder from '../../components/AudioRecorder'
import VideoRecorder from '../../components/VideoRecorder'
import PhotoUpload from '../../components/PhotoUpload'
import ErrorBanner from '../../components/ErrorBanner'
import { createIntake, uploadMedia, appendMessage, listSavedVehicles, createSavedVehicle } from '../../lib/db'
import { isStubMode } from '../../lib/ai/client'
import { useAuth } from '../../context/AuthContext'

export default function IntakeNew() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const shopSlug = params.get('shop')
  const { user } = useAuth()

  const [step, setStep] = useState(1)
  const [vehicle, setVehicle] = useState(null)
  const [savedVehicles, setSavedVehicles] = useState([])
  const [showVehicleForm, setShowVehicleForm] = useState(false)
  const [modality, setModality] = useState(null)
  const [audioBlob, setAudioBlob] = useState(null)
  const [videoBlob, setVideoBlob] = useState(null)
  const [photoFiles, setPhotoFiles] = useState([])
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) {
      setSavedVehicles([])
      return
    }
    listSavedVehicles()
      .then(setSavedVehicles)
      .catch((err) => console.error('Failed to load saved vehicles:', err))
  }, [user])

  const handleVehicleSubmit = ({ saveToAccount, ...vehicleFields }) => {
    setVehicle(vehicleFields)
    setStep(2)
    if (saveToAccount) {
      createSavedVehicle({
        year: vehicleFields.year,
        make: vehicleFields.make,
        model: vehicleFields.model,
        mileage: vehicleFields.mileage,
        nickname: null,
        isDefault: savedVehicles.length === 0,
      }).catch((err) => console.error('Failed to save vehicle:', err))
    }
  }

  const selectSavedVehicle = (v) => {
    setVehicle({ year: v.year, make: v.make, model: v.model, mileage: v.mileage, trim: null })
    setStep(2)
  }

  const canSubmit = () => {
    if (!modality) return false
    if (modality === 'audio') return !!audioBlob
    if (modality === 'video') return !!videoBlob
    if (modality === 'photo') return photoFiles.length > 0
    if (modality === 'text') return text.trim().length > 0
    return false
  }

  const submit = async () => {
    if (!vehicle) return
    setSubmitting(true)
    setError(null)
    try {
      const intake = await createIntake({ shopSlug, vehicle })
      await appendMessage(intake.id, 'system', { type: 'system_event', event: 'intake_started' })
      if (isStubMode()) {
        await appendMessage(intake.id, 'system', { type: 'system_event', event: 'stub_mode' })
      }

      if (modality === 'audio' && audioBlob) {
        const ext = (audioBlob.type?.split('/')[1] || 'webm').split(';')[0]
        await uploadMedia(intake.id, {
          kind: 'audio',
          file: new File([audioBlob], `recording.${ext}`, { type: audioBlob.type || 'audio/webm' }),
        })
      } else if (modality === 'video' && videoBlob) {
        const ext = (videoBlob.type?.split('/')[1] || 'webm').split(';')[0]
        await uploadMedia(intake.id, {
          kind: 'video',
          file: new File([videoBlob], `recording.${ext}`, { type: videoBlob.type || 'video/webm' }),
        })
      } else if (modality === 'photo' && photoFiles?.length) {
        for (const file of photoFiles) {
          await uploadMedia(intake.id, { kind: 'photo', file })
        }
      } else if (modality === 'text') {
        await uploadMedia(intake.id, { kind: 'text', textContent: text.trim() })
      }

      navigate(`/intake/${intake.id}`)
    } catch (err) {
      console.error(err)
      const msg = err.message || 'Failed to start intake'
      const friendly = msg.includes('row-level security')
        ? "We couldn't save your intake. Please refresh and try again — if it keeps happening, let the shop know."
        : msg
      setError(friendly)
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {shopSlug && (
        <div className="mb-6 rounded-lg border border-brand/30 bg-brand-soft px-4 py-2 text-sm text-brand">
          Priority intake for shop drop-off — this brief will be sent ahead of your appointment.
        </div>
      )}

      {step === 1 && (
        <>
          <h1 className="text-2xl font-semibold text-text">Start your intake</h1>
          <p className="mt-1 text-sm text-text-dim">First, tell us about your vehicle.</p>
          <div className="mt-8">
            {savedVehicles.length > 0 && !showVehicleForm && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {savedVehicles.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => selectSavedVehicle(v)}
                      className="rounded-xl border border-line bg-panel px-4 py-3 text-left text-sm hover:border-brand/50"
                    >
                      <span className="font-medium text-text">
                        {v.year} {v.make} {v.model}
                      </span>
                      {v.nickname && <span className="ml-1 text-text-mute">({v.nickname})</span>}
                      {v.mileage != null && (
                        <span className="ml-1 text-text-mute">· {v.mileage.toLocaleString()} mi</span>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowVehicleForm(true)}
                  className="text-sm text-text-dim hover:text-text"
                >
                  + Add a different vehicle
                </button>
              </div>
            )}

            {(savedVehicles.length === 0 || showVehicleForm) && (
              <VehicleForm submitting={submitting} showSaveToAccount={!!user} onSubmit={handleVehicleSubmit} />
            )}
          </div>
        </>
      )}

      {step === 2 && vehicle && (
        <>
          <p className="text-xs uppercase tracking-wide text-text-mute">
            {vehicle.year} {vehicle.make} {vehicle.model}
            {vehicle.mileage != null ? ` · ${vehicle.mileage.toLocaleString()} mi` : ''}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-text">How would you like to describe the problem?</h1>
          <p className="mt-1 text-sm text-text-dim">Pick one to start — you can add more detail in follow-up questions.</p>

          <div className="mt-8">
            <InputPicker value={modality} onChange={setModality} />
          </div>

          {modality && (
            <div className="mt-8">
              {modality === 'audio' && <AudioRecorder onCapture={setAudioBlob} />}
              {modality === 'video' && <VideoRecorder onCapture={setVideoBlob} />}
              {modality === 'photo' && (
                <PhotoUpload onCapture={(files) => setPhotoFiles(files ?? [])} />
              )}
              {modality === 'text' && (
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  placeholder="e.g. It makes a grinding noise when I brake at highway speed, especially when it's cold."
                  className="w-full rounded-xl border border-line bg-panel p-4 text-sm text-text placeholder:text-text-mute focus:border-brand/50 focus:outline-none"
                />
              )}
            </div>
          )}

          <ErrorBanner message={error} onRetry={submit} />

          <div className="mt-10 flex justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-sm text-text-dim hover:text-text"
            >
              ← Edit vehicle
            </button>
            <button
              type="button"
              disabled={!canSubmit() || submitting}
              onClick={submit}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-ink hover:bg-brand-dim disabled:opacity-40"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Starting…
                </>
              ) : (
                <>
                  Continue <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
