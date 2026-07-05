import { useState } from 'react'

const TOP_MAKES = [
  'Acura', 'Audi', 'BMW', 'Buick', 'Cadillac', 'Chevrolet', 'Chrysler', 'Dodge',
  'Ford', 'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Jeep', 'Kia', 'Lexus',
  'Lincoln', 'Mazda', 'Mercedes-Benz', 'Mini', 'Mitsubishi', 'Nissan', 'Ram',
  'Subaru', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo', 'Other',
]

const currentYear = new Date().getFullYear()

export default function VehicleForm({ onSubmit, submitting }) {
  const [year, setYear] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [mileage, setMileage] = useState('')
  const [error, setError] = useState(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    setError(null)

    const yearNum = parseInt(year, 10)
    if (!yearNum || yearNum < 1980 || yearNum > currentYear + 1) {
      setError(`Enter a valid year (1980–${currentYear + 1})`)
      return
    }
    if (!make.trim()) {
      setError('Make is required')
      return
    }
    if (!model.trim()) {
      setError('Model is required')
      return
    }

    const mileageNum = mileage.trim() ? parseInt(mileage, 10) : null
    if (mileage.trim() && (Number.isNaN(mileageNum) || mileageNum < 0)) {
      setError('Enter a valid mileage or leave blank')
      return
    }

    onSubmit({
      year: yearNum,
      make: make.trim(),
      model: model.trim(),
      mileage: mileageNum,
      trim: null,
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
          <input
            list="vehicle-makes"
            required
            value={make}
            onChange={(e) => setMake(e.target.value)}
            placeholder="Toyota"
            className="mt-1 w-full rounded-xl border border-line bg-ink p-3 text-sm focus:border-brand/50 focus:outline-none"
          />
          <datalist id="vehicle-makes">
            {TOP_MAKES.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-mute">Model *</span>
          <input
            type="text"
            required
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Camry"
            className="mt-1 w-full rounded-xl border border-line bg-ink p-3 text-sm focus:border-brand/50 focus:outline-none"
          />
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

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-ink hover:bg-brand-dim disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </form>
  )
}
