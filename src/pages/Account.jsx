import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, FileText } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  listConsumerIntakes,
  listSavedVehicles,
  createSavedVehicle,
  updateSavedVehicle,
  deleteSavedVehicle,
  setDefaultVehicle,
} from '../lib/db'
import { isSupabaseConfigured } from '../lib/supabase'
import VehicleForm from '../components/intake/VehicleForm'

function formatVehicle(vehicle) {
  if (!vehicle) return 'Intake'
  const parts = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean)
  return parts.join(' ') || 'Intake'
}

export default function Account() {
  const { isSignedIn, loading: authLoading, openAuthModal } = useAuth()
  const [intakes, setIntakes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [vehiclesError, setVehiclesError] = useState(null)
  const [addingVehicle, setAddingVehicle] = useState(false)
  const [editingVehicleId, setEditingVehicleId] = useState(null)

  useEffect(() => {
    if (authLoading) return
    if (!isSignedIn) {
      setLoading(false)
      return
    }
    Promise.all([
      listConsumerIntakes().catch((err) => {
        setError(err.message)
        return []
      }),
      listSavedVehicles().catch((err) => {
        setVehiclesError(err.message)
        return []
      }),
    ])
      .then(([intakesData, vehiclesData]) => {
        setIntakes(intakesData)
        setVehicles(vehiclesData)
      })
      .finally(() => setLoading(false))
  }, [isSignedIn, authLoading])

  const refreshVehicles = () => {
    listSavedVehicles()
      .then(setVehicles)
      .catch((err) => setVehiclesError(err.message))
  }

  const handleAddVehicle = async (fields) => {
    try {
      await createSavedVehicle({
        year: fields.year,
        make: fields.make,
        model: fields.model,
        mileage: fields.mileage,
        nickname: null,
        isDefault: vehicles.length === 0,
      })
      setAddingVehicle(false)
      refreshVehicles()
    } catch (err) {
      setVehiclesError(err.message)
    }
  }

  const handleEditVehicle = async (id, fields) => {
    try {
      await updateSavedVehicle(id, {
        year: fields.year,
        make: fields.make,
        model: fields.model,
        mileage: fields.mileage,
      })
      setEditingVehicleId(null)
      refreshVehicles()
    } catch (err) {
      setVehiclesError(err.message)
    }
  }

  const handleDeleteVehicle = async (id) => {
    try {
      await deleteSavedVehicle(id)
      refreshVehicles()
    } catch (err) {
      setVehiclesError(err.message)
    }
  }

  const handleSetDefault = async (id) => {
    try {
      await setDefaultVehicle(id)
      refreshVehicles()
    } catch (err) {
      setVehiclesError(err.message)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-text-dim">
        <Loader2 className="mr-2 animate-spin" size={18} /> Loading…
      </div>
    )
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="text-text-dim">Account features require Supabase configuration.</p>
        <Link to="/" className="mt-4 inline-block text-brand">
          Back home
        </Link>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold text-text">My intakes</h1>
        <p className="mt-2 text-sm text-text-dim">Sign in to view your saved mechanic briefs.</p>
        <button
          type="button"
          onClick={() => openAuthModal({ mode: 'login', disableSkip: true })}
          className="mt-6 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-ink hover:bg-brand-dim"
        >
          Log in
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-text">My vehicles</h1>
      <p className="mt-1 text-sm text-text-dim">Save vehicles so you don't have to re-enter them at intake.</p>

      {vehiclesError && <p className="mt-6 text-sm text-danger">{vehiclesError}</p>}

      {vehicles.length === 0 && !addingVehicle ? (
        <div className="mt-6 rounded-2xl border border-line bg-panel p-6 text-center">
          <p className="text-sm text-text-dim">No saved vehicles yet. They'll appear here after your next intake.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {vehicles.map((v) =>
            editingVehicleId === v.id ? (
              <li key={v.id} className="rounded-xl border border-line bg-panel p-4">
                <VehicleForm
                  initialValues={v}
                  submitLabel="Save"
                  onSubmit={(fields) => handleEditVehicle(v.id, fields)}
                />
                <button
                  type="button"
                  onClick={() => setEditingVehicleId(null)}
                  className="mt-3 text-xs text-text-dim hover:text-text"
                >
                  Cancel
                </button>
              </li>
            ) : (
              <li
                key={v.id}
                className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-4"
              >
                <div>
                  <p className="font-medium text-text">
                    {v.year} {v.make} {v.model}
                    {v.is_default && (
                      <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold uppercase text-brand">
                        Default
                      </span>
                    )}
                  </p>
                  {v.mileage != null && (
                    <p className="mt-0.5 text-xs text-text-mute">{v.mileage.toLocaleString()} mi</p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {!v.is_default && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(v.id)}
                      className="text-text-dim hover:text-text"
                    >
                      Set default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingVehicleId(v.id)}
                    className="text-text-dim hover:text-text"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteVehicle(v.id)}
                    className="text-danger hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      )}

      {addingVehicle ? (
        <div className="mt-6 rounded-xl border border-line bg-panel p-4">
          <VehicleForm submitLabel="Save vehicle" onSubmit={handleAddVehicle} />
          <button
            type="button"
            onClick={() => setAddingVehicle(false)}
            className="mt-3 text-xs text-text-dim hover:text-text"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddingVehicle(true)}
          className="mt-6 text-sm text-brand hover:underline"
        >
          + Add vehicle
        </button>
      )}

      <h2 className="mt-14 text-2xl font-semibold text-text">My intakes</h2>
      <p className="mt-1 text-sm text-text-dim">Your saved mechanic briefs across devices.</p>

      {error && <p className="mt-6 text-sm text-danger">{error}</p>}

      {intakes.length === 0 && !error ? (
        <div className="mt-10 rounded-2xl border border-line bg-panel p-8 text-center">
          <FileText className="mx-auto text-text-mute" size={28} />
          <p className="mt-3 text-sm text-text-dim">No saved intakes yet.</p>
          <Link to="/" className="mt-4 inline-block text-sm text-brand hover:underline">
            Start your first intake
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {intakes.map((intake) => (
            <li key={intake.id}>
              <Link
                to={`/account/${intake.id}`}
                className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-4 hover:border-brand/50"
              >
                <div>
                  <p className="font-medium text-text">{formatVehicle(intake.vehicle)}</p>
                  <p className="mt-0.5 text-xs text-text-mute">
                    {intake.brief?.category ?? 'Mechanic brief'} ·{' '}
                    {new Date(intake.completed_at ?? intake.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs text-text-dim">{intake.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
