import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Loader2 } from 'lucide-react'
import InputPicker from '../../components/InputPicker'
import AudioRecorder from '../../components/AudioRecorder'
import VideoRecorder from '../../components/VideoRecorder'
import PhotoUpload from '../../components/PhotoUpload'
import ErrorBanner from '../../components/ErrorBanner'
import { createIntake, uploadMedia, appendMessage } from '../../lib/db'
import { isStubMode } from '../../lib/ai/client'

export default function IntakeNew() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const shopSlug = params.get('shop')

  const [modality, setModality] = useState(null)
  const [audioBlob, setAudioBlob] = useState(null)
  const [videoBlob, setVideoBlob] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const canSubmit = () => {
    if (!modality) return false
    if (modality === 'audio') return !!audioBlob
    if (modality === 'video') return !!videoBlob
    if (modality === 'photo') return !!photoFile
    if (modality === 'text') return text.trim().length > 0
    return false
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const intake = await createIntake({ shopSlug })
      await appendMessage(intake.id, 'system', { type: 'system_event', event: 'intake_started' })
      if (isStubMode()) {
        await appendMessage(intake.id, 'system', { type: 'system_event', event: 'stub_mode' })
      }

      if (modality === 'audio' && audioBlob) {
        await uploadMedia(intake.id, {
          kind: 'audio',
          file: new File([audioBlob], 'recording.webm', { type: audioBlob.type || 'audio/webm' }),
        })
      } else if (modality === 'video' && videoBlob) {
        await uploadMedia(intake.id, {
          kind: 'video',
          file: new File([videoBlob], 'recording.webm', { type: videoBlob.type || 'video/webm' }),
        })
      } else if (modality === 'photo' && photoFile) {
        await uploadMedia(intake.id, { kind: 'photo', file: photoFile })
      } else if (modality === 'text') {
        await uploadMedia(intake.id, { kind: 'text', textContent: text.trim() })
      }

      navigate(`/intake/${intake.id}`)
    } catch (err) {
      setError(err.message || 'Failed to start intake')
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

      <h1 className="text-2xl font-semibold text-text">How would you like to describe the problem?</h1>
      <p className="mt-1 text-sm text-text-dim">Pick one to start — you can add more detail in follow-up questions.</p>

      <div className="mt-8">
        <InputPicker value={modality} onChange={setModality} />
      </div>

      {modality && (
        <div className="mt-8">
          {modality === 'audio' && <AudioRecorder onCapture={setAudioBlob} />}
          {modality === 'video' && <VideoRecorder onCapture={setVideoBlob} />}
          {modality === 'photo' && <PhotoUpload onCapture={(files) => setPhotoFile(files?.[0] ?? null)} single />}
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

      <div className="mt-10 flex justify-end">
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
    </div>
  )
}
