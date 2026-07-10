import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Loader2, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { requireSupabase } from '../lib/supabase'
import { setPostAuthRedirect } from '../lib/deviceId'

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
]

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const detectedTimezone = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'
  } catch {
    return 'America/New_York'
  }
})()

export default function ShopSignup() {
  const navigate = useNavigate()
  const { loading, isSignedIn, user, shopMemberships, openAuthModal, refreshShopMemberships } = useAuth()

  useEffect(() => {
    if (loading || isSignedIn) return
    openAuthModal({
      mode: 'start',
      onBeforeOAuth: () => setPostAuthRedirect('/for-shops/signup'),
    })
    navigate('/', { replace: true })
  }, [loading, isSignedIn, navigate, openAuthModal])

  const ownedMembership = shopMemberships.find((m) => m.role === 'owner')

  useEffect(() => {
    if (!loading && ownedMembership) {
      navigate(`/shop/${ownedMembership.shops.slug}`, { replace: true })
    }
  }, [loading, ownedMembership, navigate])

  if (loading || !isSignedIn || ownedMembership) {
    return <p className="py-20 text-center text-text-dim">Loading…</p>
  }

  return <ShopSignupForm user={user} refreshShopMemberships={refreshShopMemberships} />
}

function ShopSignupForm({ user, refreshShopMemberships }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [slugCheck, setSlugCheck] = useState('idle') // idle | checking | available | unavailable
  const [contactEmail, setContactEmail] = useState(user?.email || '')
  const [timezone, setTimezone] = useState(detectedTimezone)
  const [agreed, setAgreed] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const handleNameChange = (e) => {
    const value = e.target.value
    setName(value)
    if (!slugEdited) setSlug(slugify(value))
  }

  const handleSlugChange = (e) => {
    setSlug(slugify(e.target.value))
    setSlugEdited(true)
  }

  useEffect(() => {
    if (!slug) {
      setSlugCheck('idle')
      return
    }
    setSlugCheck('checking')
    const timer = window.setTimeout(async () => {
      try {
        const sb = requireSupabase()
        const { data, error } = await sb.rpc('is_shop_slug_available', { p_slug: slug })
        if (error) throw error
        setSlugCheck(data ? 'available' : 'unavailable')
      } catch {
        setSlugCheck('unavailable')
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [slug])

  const validate = () => {
    const next = {}
    if (name.trim().length < 3 || name.trim().length > 80) {
      next.name = 'Shop name must be 3-80 characters'
    }
    if (!slug || slugCheck !== 'available') {
      next.slug = 'Choose an available slug'
    }
    if (!contactEmail.trim()) {
      next.contactEmail = 'Contact email is required'
    }
    if (!agreed) {
      next.agreed = 'You must agree to the terms to continue'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError(null)
    if (!validate()) return

    setSubmitting(true)
    try {
      const sb = requireSupabase()
      const { data: shopId, error } = await sb.rpc('create_shop_self_serve', {
        p_name: name.trim(),
        p_slug: slug,
        p_contact_email: contactEmail.trim(),
        p_timezone: timezone,
      })
      if (error) throw error

      // Fire-and-forget notification to Yash/Alex — never block navigation on this.
      sb.functions.invoke('notify_new_shop', { body: { shop_id: shopId } }).catch((err) => {
        console.warn('Failed to send new shop notification:', err)
      })

      await refreshShopMemberships()
      navigate(`/shop/${slug}`)
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-semibold text-white">Set up your shop</h1>
      <p className="mt-2 text-sm text-white/50">
        Free 30-day pilot, up to 50 intakes, no credit card. You'll be the owner and can invite
        your team once you're in.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label="Shop name" error={errors.name}>
          <input
            value={name}
            onChange={handleNameChange}
            placeholder="Main Street Auto"
            className="w-full rounded-xl border border-line bg-panel p-3 text-sm text-white focus:border-brand/50 focus:outline-none"
          />
        </Field>

        <Field label="Slug — greenlit.co/shop/…" error={errors.slug}>
          <div className="relative">
            <input
              value={slug}
              onChange={handleSlugChange}
              placeholder="main-street-auto"
              className="w-full rounded-xl border border-line bg-panel p-3 pr-10 text-sm text-white focus:border-brand/50 focus:outline-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {slugCheck === 'checking' && (
                <Loader2 size={16} className="animate-spin text-white/40" />
              )}
              {slugCheck === 'available' && <Check size={16} className="text-brand" />}
              {slugCheck === 'unavailable' && <X size={16} className="text-danger" />}
            </span>
          </div>
        </Field>

        <Field label="Contact email" error={errors.contactEmail}>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="w-full rounded-xl border border-line bg-panel p-3 text-sm text-white focus:border-brand/50 focus:outline-none"
          />
        </Field>

        <Field label="Timezone">
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-xl border border-line bg-panel p-3 text-sm text-white focus:border-brand/50 focus:outline-none"
          >
            {!TIMEZONES.includes(timezone) && <option value={timezone}>{timezone}</option>}
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </Field>

        <label className="flex items-start gap-2.5 text-sm text-white/60">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            I agree to the{' '}
            <a href="/terms" target="_blank" rel="noreferrer" className="text-brand hover:underline">
              Terms of Service
            </a>{' '}
            and understand Greenlit is provided as-is during the pilot.
          </span>
        </label>
        {errors.agreed && <p className="text-xs text-danger">{errors.agreed}</p>}

        {submitError && <p className="text-sm text-danger">{submitError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-ink hover:bg-brand-dim disabled:opacity-50"
        >
          {submitting ? 'Setting up your shop…' : 'Create my shop'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-white/60">{label}</span>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </label>
  )
}
