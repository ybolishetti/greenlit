import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import OptionCard from '../../components/OptionCard'
import FeelSlider from '../../components/FeelSlider'
import AudioRecorder from '../../components/AudioRecorder'
import PhotoUpload from '../../components/PhotoUpload'
import {
  CATEGORY_OPTIONS,
  DESCRIPTOR_OPTIONS,
  TIMING_OPTIONS,
  DURATION_OPTIONS,
  WARNING_LIGHT_OPTIONS,
} from '../../lib/mockDiagnosis'
import { saveIntake, makeId } from '../../lib/storage'

const TOTAL_STEPS = 5

export default function IntakeFlow() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const shopId = params.get('shop') || null

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    category: '',
    descriptor: '',
    timing: '',
    duration: '',
    warningLight: 'none',
    feel: { pedal: 0, steering: 0, vibration: 0 },
    hasAudio: false,
    hasPhoto: false,
    notes: '',
    customerName: '',
  })

  const descriptorOptions = useMemo(
    () => (form.category ? DESCRIPTOR_OPTIONS[form.category] || [] : []),
    [form.category]
  )

  const update = (patch) => setForm((f) => ({ ...f, ...patch }))

  const canAdvance = () => {
    if (step === 1) return form.category && form.descriptor
    if (step === 2) return form.timing && form.duration
    if (step === 3) return true
    if (step === 4) return true
    return true
  }

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS))
  const back = () => setStep((s) => Math.max(s - 1, 1))

  const submit = () => {
    setSubmitting(true)
    const intake = {
      id: makeId(),
      createdAt: Date.now(),
      shopId,
      status: 'new',
      ...form,
    }
    setTimeout(() => {
      saveIntake(intake)
      navigate(`/brief/${intake.id}`)
    }, 900)
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {shopId && (
        <div className="mb-6 rounded-lg border border-lime/30 bg-lime/5 px-4 py-2 text-sm text-lime">
          Priority intake for shop drop-off — this brief will be sent ahead of your appointment.
        </div>
      )}

      <ProgressBar step={step} total={TOTAL_STEPS} />

      <div className="mt-8">
        {step === 1 && (
          <StepShell title="Where do you notice the problem?" subtitle="Pick the closest match — we'll ask more specific questions next.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
              {CATEGORY_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.value}
                  label={opt.label}
                  selected={form.category === opt.value}
                  onClick={() => update({ category: opt.value, descriptor: '' })}
                />
              ))}
            </div>

            {form.category && (
              <div className="mt-8">
                <p className="mb-3 text-sm font-medium text-white/70">
                  What does it sound or feel like?
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {descriptorOptions.map((opt) => (
                    <OptionCard
                      key={opt.value}
                      label={opt.label}
                      selected={form.descriptor === opt.value}
                      onClick={() => update({ descriptor: opt.value })}
                    />
                  ))}
                </div>
              </div>
            )}
          </StepShell>
        )}

        {step === 2 && (
          <StepShell title="When does it happen?" subtitle="This helps narrow down probable causes.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {TIMING_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.value}
                  label={opt.label}
                  selected={form.timing === opt.value}
                  onClick={() => update({ timing: opt.value })}
                />
              ))}
            </div>

            <p className="mb-3 mt-8 text-sm font-medium text-white/70">How long has this been going on?</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {DURATION_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.value}
                  label={opt.label}
                  selected={form.duration === opt.value}
                  onClick={() => update({ duration: opt.value })}
                />
              ))}
            </div>

            <p className="mb-3 mt-8 text-sm font-medium text-white/70">Any warning lights on the dashboard?</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {WARNING_LIGHT_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.value}
                  label={opt.label}
                  selected={form.warningLight === opt.value}
                  onClick={() => update({ warningLight: opt.value })}
                />
              ))}
            </div>
          </StepShell>
        )}

        {step === 3 && (
          <StepShell title="How does it feel?" subtitle="No mechanical knowledge required — just your read on it.">
            <div className="space-y-8 rounded-2xl border border-line bg-panel p-6">
              <FeelSlider
                label="Pedal stiffness"
                lowLabel="Normal"
                highLabel="Very stiff"
                value={form.feel.pedal}
                onChange={(v) => update({ feel: { ...form.feel, pedal: v } })}
              />
              <FeelSlider
                label="Steering resistance"
                lowLabel="Normal"
                highLabel="Very resistant"
                value={form.feel.steering}
                onChange={(v) => update({ feel: { ...form.feel, steering: v } })}
              />
              <FeelSlider
                label="Vibration intensity"
                lowLabel="None"
                highLabel="Very strong"
                value={form.feel.vibration}
                onChange={(v) => update({ feel: { ...form.feel, vibration: v } })}
              />
            </div>
          </StepShell>
        )}

        {step === 4 && (
          <StepShell title="Add audio or photo" subtitle="Optional, but it makes your brief much stronger.">
            <p className="mb-3 text-sm font-medium text-white/70">Audio</p>
            <AudioRecorder onChange={(has) => update({ hasAudio: has })} />
            <p className="mb-3 mt-8 text-sm font-medium text-white/70">Photo or video</p>
            <PhotoUpload onChange={(has) => update({ hasPhoto: has })} />
          </StepShell>
        )}

        {step === 5 && (
          <StepShell title="Anything else?" subtitle="Describe it in your own words — this gets attached to your brief exactly as written.">
            <textarea
              value={form.notes}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="e.g. It happens when I brake at highway speed, only when it's cold out."
              rows={5}
              className="w-full rounded-xl border border-line bg-panel p-4 text-sm text-white placeholder:text-white/30 focus:border-lime/50 focus:outline-none"
            />
            <input
              value={form.customerName}
              onChange={(e) => update({ customerName: e.target.value })}
              placeholder="Your name (optional)"
              className="mt-4 w-full rounded-xl border border-line bg-panel p-4 text-sm text-white placeholder:text-white/30 focus:border-lime/50 focus:outline-none"
            />
          </StepShell>
        )}
      </div>

      <div className="mt-10 flex items-center justify-between">
        <button
          onClick={back}
          disabled={step === 1}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-white/60 hover:text-white disabled:opacity-0"
        >
          <ArrowLeft size={15} />
          Back
        </button>

        {step < TOTAL_STEPS ? (
          <button
            onClick={next}
            disabled={!canAdvance()}
            className="inline-flex items-center gap-2 rounded-xl bg-lime px-6 py-3 text-sm font-semibold text-ink hover:bg-lime-dim disabled:opacity-30 transition-colors"
          >
            Continue
            <ArrowRight size={16} />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-lime px-6 py-3 text-sm font-semibold text-ink hover:bg-lime-dim disabled:opacity-60 transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating brief…
              </>
            ) : (
              'Generate mechanic brief'
            )}
          </button>
        )}
      </div>
    </div>
  )
}

function StepShell({ title, subtitle, children }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-white/50">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  )
}

function ProgressBar({ step, total }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-lime' : 'bg-line'}`}
        />
      ))}
    </div>
  )
}
