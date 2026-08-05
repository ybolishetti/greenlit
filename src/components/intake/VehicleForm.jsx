import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { VEHICLE_MAKES, MAKE_MODELS, OTHER, isKnownMake, isKnownModel } from '../../lib/vehicleData'

const currentYear = new Date().getFullYear()

const selectClass =
  'mt-1 w-full appearance-none rounded-xl border border-line bg-ink p-3 pr-10 text-sm text-text focus:border-brand/50 focus:outline-none'
const inputClass =
  'mt-1 w-full rounded-xl border border-line bg-ink p-3 text-sm text-text focus:border-brand/50 focus:outline-none'

export default function VehicleForm({
  onSubmit,
  submitting,
  showSaveToAccount = false,
  initialValues,
  submitLabel = 'Continue',
}) {
  const [year, setYear] = useState(initialValues?.year != null ? String(initialValues.year) : '')

  // A make/model that isn't in our curated lists (e.g. a saved vehicle typed
  // before dropdowns existed, or an uncommon vehicle) is represented as the
  // "Other" dropdown selection with the real value held in the free-text field.
  const initialMake = initialValues?.make ?? ''
  const initialMakeKnown = isKnownMake(initialMake)
  const [makeSelect, setMakeSelect] = useState(initialMake ? (initialMakeKnown ? initialMake : OTHER) : '')
  const [makeOther, setMakeOther] = useState(initialMake && !initialMakeKnown ? initialMake : '')

  const initialModel = initialValues?.model ?? ''
  const initialModelKnown = isKnownModel(initialMake, initialModel)
  const [modelSelect, setModelSelect] = useState(initialModel ? (initialModelKnown ? initialModel : OTHER) : '')
  const [modelOther, setModelOther] = useState(initialModel && !initialModelKnown ? initialModel : '')

  const [mileage, setMileage] = useState(initialValues?.mileage != null ? String(initialValues.mileage) : '')
  const [saveToAccount, setSaveToAccount] = useState(true)
  const [error, setError] = useState(null)

  const makeIsOther = makeSelect === OTHER
  const modelIsOther = modelSelect === OTHER
  // The model dropdown only has real options for a known make; for "Other"
  // make we skip straight to a free-text model field.
  const modelOptions = makeIsOther ? [] : MAKE_MODELS[makeSelect] ?? []

  const resolvedMake = (makeIsOther ? makeOther : makeSelect).trim()
  const resolvedModel = (makeIsOther || modelIsOther ? modelOther : modelSelect).trim()

  const onMakeChange = (value) => {
    setMakeSelect(value)
    // Changing make invalidates any previously chosen model.
    setModelSelect('')
    setModelOther('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError(null)

    const yearNum = parseInt(year, 10)
    if (!yearNum || yearNum < 1980 || yearNum > currentYear + 1) {
      setError(`Enter a valid year (1980–${currentYear + 1})`)
      return
    }
    if (!makeSelect) {
      setError('Make is required')
      return
    }
    if (!resolvedMake) {
      setError('Enter the make')
      return
    }
    if (!makeIsOther && modelOptions.length > 0 && !modelSelect) {
      setError('Model is required')
      return
    }
    if (!resolvedModel) {
      setError('Enter the model')
      return
    }

    const mileageNum = mileage.trim() ? parseInt(mileage, 10) : null
    if (mileage.trim() && (Number.isNaN(mileageNum) || mileageNum < 0)) {
      setError('Enter a valid mileage or leave blank')
      return
    }

    onSubmit({
      year: yearNum,
      make: resolvedMake,
      model: resolvedModel,
      mileage: mileageNum,
      trim: null,
      saveToAccount: showSaveToAccount ? saveToAccount : false,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-line bg-panel p-6">
      <h2 className="text-lg font-semibold text-text">Tell us about your vehicle</h2>
      <p className="mt-1 text-sm text-text-dim">
        Year, make, and model help narrow likely causes before we ask about symptoms.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-text-mute">Year *</span>
          <input
            type="number"
            required
            min={1980}
            max={currentYear + 1}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder={String(currentYear)}
            className="mt-1 w-full rounded-xl border border-line bg-ink p-3 text-sm focus:border-brand/50 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-text-mute">Make *</span>
          <div className="relative">
            <select
              value={makeSelect}
              onChange={(e) => onMakeChange(e.target.value)}
              className={selectClass}
            >
              <option value="" disabled>
                Select make
              </option>
              {VEHICLE_MAKES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value={OTHER}>Other / not listed</option>
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-mute"
            />
          </div>
          {makeIsOther && (
            <input
              type="text"
              value={makeOther}
              onChange={(e) => setMakeOther(e.target.value)}
              placeholder="Enter make"
              className={inputClass}
            />
          )}
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-mute">Model *</span>
          {makeIsOther || modelOptions.length === 0 ? (
            <input
              type="text"
              value={modelOther}
              onChange={(e) => setModelOther(e.target.value)}
              placeholder="Enter model"
              disabled={!makeSelect}
              className={`${inputClass} disabled:opacity-40`}
            />
          ) : (
            <>
              <div className="relative">
                <select
                  value={modelSelect}
                  onChange={(e) => setModelSelect(e.target.value)}
                  className={selectClass}
                >
                  <option value="" disabled>
                    Select model
                  </option>
                  {modelOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value={OTHER}>Other / not listed</option>
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-mute"
                />
              </div>
              {modelIsOther && (
                <input
                  type="text"
                  value={modelOther}
                  onChange={(e) => setModelOther(e.target.value)}
                  placeholder="Enter model"
                  className={inputClass}
                />
              )}
            </>
          )}
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-mute">
            Mileage (optional)
          </span>
          <input
            type="number"
            min={0}
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            placeholder="145000"
            className="mt-1 w-full rounded-xl border border-line bg-ink p-3 text-sm focus:border-brand/50 focus:outline-none"
          />
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {showSaveToAccount && (
        <label className="mt-4 flex items-center gap-2 text-xs text-text-dim">
          <input
            type="checkbox"
            checked={saveToAccount}
            onChange={(e) => setSaveToAccount(e.target.checked)}
            className="rounded border-line"
          />
          Save this vehicle to my account for next time
        </label>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-ink hover:bg-brand-dim disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
