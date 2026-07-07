import { useState } from 'react'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { createShopLead } from '../lib/db/shopLeads'
import { isSupabaseConfigured } from '../lib/supabase'

const SALES_EMAIL = import.meta.env.VITE_SALES_EMAIL || 'hello@greenlit.co'

const HOW_IT_WORKS = [
  {
    title: 'Counter QR',
    desc: 'We ship you a printed QR kit. Customers scan at drop-off.',
  },
  {
    title: 'Auto-populated dashboard',
    desc: "Their intake shows up in your dashboard before they hand you the keys.",
  },
  {
    title: 'Rate outcomes, sharpen the AI',
    desc: 'One tap after the repair. Your feedback trains the model that serves your shop.',
  },
]

const VALUE_PROPS = [
  {
    title: 'Save 10-20 min per intake',
    desc: "No more decoding \"it makes a weird noise sometimes.\"",
  },
  {
    title: 'Higher repair acceptance',
    desc: 'Customers who see a structured brief approve more work. Fewer declined repairs.',
  },
  {
    title: 'Own your data',
    desc: 'Every intake and outcome is yours. Export any time.',
  },
  {
    title: 'Zero disruption',
    desc: 'Works alongside your shop management software. No workflow change required.',
  },
]

const PRICING = [
  {
    id: 'standard',
    name: 'Standard',
    price: '$149/mo',
    intakes: '100 intakes included',
    overage: '$1.50 each after',
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$349/mo',
    intakes: '300 intakes included',
    overage: '$1.25 each after',
    popular: true,
  },
  {
    id: 'high_volume',
    name: 'High-volume',
    price: 'Custom',
    intakes: 'Custom volume',
    overage: 'Custom',
    cta: 'Talk to us',
  },
]

const FAQS = [
  {
    q: 'How do you count an intake?',
    a: 'Any completed customer intake that produces a mechanic brief. Abandoned/incomplete sessions don’t count.',
  },
  {
    q: 'Do you charge per staff member?',
    a: 'No. Every plan includes unlimited seats — front desk, service advisors, techs, however you’re set up.',
  },
  {
    q: 'How long is the pilot?',
    a: '30 days, free, up to 50 intakes. No credit card required. If it doesn’t earn its keep, no hard feelings.',
  },
  {
    q: 'Do we need special hardware?',
    a: 'No. We ship a printable QR kit for your counter. Customers use their own phones.',
  },
  {
    q: 'Who owns the intake data?',
    a: 'You do. Full export any time. We use anonymized outcome data to improve the shared diagnostic model — never your customer PII.',
  },
]

const INTAKE_BUCKETS = ['<50', '50-150', '150-400', '400+']

const leadSchema = z.object({
  shop_name: z.string().trim().min(1, 'Shop name is required'),
  contact_name: z.string().trim().min(1, 'Your name is required'),
  contact_email: z.string().trim().email('Enter a valid email'),
  contact_phone: z.string().trim().optional(),
  location: z.string().trim().optional(),
  bays: z.string().trim().optional(),
  monthly_intakes: z.string().optional(),
  notes: z.string().trim().optional(),
})

const EMPTY_FORM = {
  shop_name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  location: '',
  bays: '',
  monthly_intakes: '',
  notes: '',
}

export default function ForShops() {
  return (
    <div>
      <Hero />
      <HowItWorks />
      <ValueProps />
      <Pricing />
      <FAQ />
      <ContactSection />
      <FooterCta />
    </div>
  )
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
      <p className="text-sm font-medium tracking-wide text-brand uppercase">For repair shops.</p>
      <h1 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight text-white">
        Every customer arrives with a mechanic-ready brief.
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60">
        Greenlit turns your customers' vague descriptions into structured diagnostic intake —
        before they hand you the keys. Faster writeups, fewer miscommunications, higher repair
        acceptance.
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
        <a
          href="#contact"
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-ink hover:bg-brand-dim transition-colors"
        >
          Talk to us about a pilot
          <ArrowRight size={16} />
        </a>
        <Link
          to="/shop/demo-shop"
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel px-6 py-3 text-sm font-medium text-white hover:border-brand/50 transition-colors"
        >
          See the demo shop
        </Link>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section className="border-t border-line/60 bg-panel/40">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold text-white">How it works for shops</h2>
        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
          {HOW_IT_WORKS.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl border border-line bg-panel p-6">
              <span className="text-3xl font-semibold text-brand/40">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-3 font-medium text-white">{s.title}</h3>
              <p className="mt-1 text-sm text-white/50">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ValueProps() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h2 className="text-center text-2xl font-semibold text-white">Why shops run Greenlit</h2>
      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {VALUE_PROPS.map(({ title, desc }) => (
          <div key={title} className="rounded-2xl border border-line bg-panel p-5">
            <h3 className="font-medium text-white">{title}</h3>
            <p className="mt-1 text-sm text-white/50">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section className="border-t border-line/60 bg-panel/40">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold text-white">Pricing</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-white/50">
          Flat platform fee, usage-based intakes. Unlimited staff seats on every plan.
        </p>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {PRICING.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border p-6 ${
                plan.popular ? 'border-brand bg-brand-soft' : 'border-line bg-panel'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 right-6 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-ink">
                  Most popular
                </span>
              )}
              <h3 className="font-medium text-white">{plan.name}</h3>
              <p className="mt-2 text-3xl font-semibold text-white">{plan.price}</p>
              <ul className="mt-4 space-y-2 text-sm text-white/60">
                <li>{plan.intakes}</li>
                <li>Overage: {plan.overage}</li>
                <li>Unlimited staff seats</li>
                <li>Branded QR kit (PDF)</li>
                <li>Full mechanic brief with audio/photo</li>
                <li>Outcome rating dashboard</li>
                <li>Email support</li>
              </ul>
              <a
                href="#contact"
                className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
                  plan.popular
                    ? 'bg-brand text-ink hover:bg-brand-dim'
                    : 'border border-line text-white hover:border-brand/50'
                }`}
              >
                {plan.cta || 'Talk to us'}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FAQ() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <h2 className="text-center text-2xl font-semibold text-white">Frequently asked questions</h2>
      <div className="mt-8 space-y-3">
        {FAQS.map(({ q, a }) => (
          <details key={q} className="group rounded-xl border border-line bg-panel p-4">
            <summary className="cursor-pointer list-none font-medium text-white">{q}</summary>
            <p className="mt-2 text-sm text-white/60">{a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

function ContactSection() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError(null)

    const parsed = leadSchema.safeParse(form)
    if (!parsed.success) {
      const fieldErrors = {}
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path[0]] = issue.message
      }
      setErrors(fieldErrors)
      return
    }
    setErrors({})

    if (!isSupabaseConfigured) {
      setSubmitError('Sign-up requires Supabase configuration.')
      return
    }

    setSubmitting(true)
    try {
      const v = parsed.data
      await createShopLead({
        shop_name: v.shop_name,
        contact_name: v.contact_name,
        contact_email: v.contact_email,
        contact_phone: v.contact_phone || null,
        location: v.location || null,
        bays: v.bays ? Number.parseInt(v.bays, 10) || null : null,
        monthly_intakes: v.monthly_intakes || null,
        notes: v.notes || null,
        source: 'landing_page',
      })
      // TODO: supabase edge function to send email notification to sales
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="contact" className="border-t border-line/60 bg-panel/40">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold text-white">Talk to us about a pilot</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-white/50">
          30 days free, up to 50 intakes, no credit card. We'll follow up within 2 business days.
        </p>

        {submitted ? (
          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand-soft px-5 py-4 text-brand">
            <CheckCircle2 size={20} />
            Thanks — we'll be in touch within 2 business days.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <Field label="Shop name" error={errors.shop_name}>
              <input
                value={form.shop_name}
                onChange={update('shop_name')}
                className="w-full rounded-xl border border-line bg-panel p-3 text-sm text-white focus:border-brand/50 focus:outline-none"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Your name" error={errors.contact_name}>
                <input
                  value={form.contact_name}
                  onChange={update('contact_name')}
                  className="w-full rounded-xl border border-line bg-panel p-3 text-sm text-white focus:border-brand/50 focus:outline-none"
                />
              </Field>
              <Field label="Email" error={errors.contact_email}>
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={update('contact_email')}
                  className="w-full rounded-xl border border-line bg-panel p-3 text-sm text-white focus:border-brand/50 focus:outline-none"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Phone (optional)">
                <input
                  value={form.contact_phone}
                  onChange={update('contact_phone')}
                  className="w-full rounded-xl border border-line bg-panel p-3 text-sm text-white focus:border-brand/50 focus:outline-none"
                />
              </Field>
              <Field label="Location — city, state (optional)">
                <input
                  value={form.location}
                  onChange={update('location')}
                  className="w-full rounded-xl border border-line bg-panel p-3 text-sm text-white focus:border-brand/50 focus:outline-none"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Bays / how many techs? (optional)">
                <input
                  type="number"
                  min="0"
                  value={form.bays}
                  onChange={update('bays')}
                  className="w-full rounded-xl border border-line bg-panel p-3 text-sm text-white focus:border-brand/50 focus:outline-none"
                />
              </Field>
              <Field label="Est. monthly intakes (optional)">
                <select
                  value={form.monthly_intakes}
                  onChange={update('monthly_intakes')}
                  className="w-full rounded-xl border border-line bg-panel p-3 text-sm text-white focus:border-brand/50 focus:outline-none"
                >
                  <option value="">Select a range</option>
                  {INTAKE_BUCKETS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="What are you trying to solve? (optional)">
              <textarea
                value={form.notes}
                onChange={update('notes')}
                rows={3}
                className="w-full rounded-xl border border-line bg-panel p-3 text-sm text-white focus:border-brand/50 focus:outline-none"
              />
            </Field>

            {submitError && <p className="text-sm text-danger">{submitError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-ink hover:bg-brand-dim disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Request a pilot'}
            </button>
          </form>
        )}
      </div>
    </section>
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

function FooterCta() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 text-center">
      <h2 className="text-2xl font-semibold text-white">Ready to try it?</h2>
      <a
        href={`mailto:${SALES_EMAIL}`}
        className="mt-6 inline-flex items-center gap-2 rounded-xl border border-line bg-panel px-5 py-3 text-sm font-medium text-white hover:border-brand/50 transition-colors"
      >
        Book a 15-min call
        <ArrowRight size={16} />
      </a>
    </section>
  )
}
