import { Link } from 'react-router-dom'
import { Camera, ListChecks, Mic } from 'lucide-react'
import DemoBanner from '../../components/DemoBanner'
import { DEMO_BRIEF_INTAKE_ID, DEMO_SLUG } from '../../lib/demoShop'

const STEPS = [
  {
    icon: Camera,
    title: '1. Pick the vehicle',
    body: 'Customer picks year, make, and model — or scans their VIN.',
  },
  {
    icon: ListChecks,
    title: '2. Answer a few guided questions',
    body: "A short back-and-forth, in the customer's own words — no mechanic jargon required.",
  },
  {
    icon: Mic,
    title: '3. Record the sound (optional)',
    body: 'Photos, a voice note, or a quick video — whatever explains the problem fastest.',
  },
]

export default function DemoIntakePreview() {
  return (
    <div>
      <DemoBanner variant="intake" />
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-text">This is what your customers see</h1>
        <p className="mt-2 text-sm text-text-dim">
          A customer scans your QR code and walks through this in about two minutes, before they ever talk to a
          tech.
        </p>

        <div className="mt-10 grid gap-4 text-left sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-line bg-panel p-5">
              <Icon size={18} className="text-brand" />
              <h3 className="mt-3 text-sm font-semibold text-text">{title}</h3>
              <p className="mt-1.5 text-xs text-text-dim">{body}</p>
            </div>
          ))}
        </div>

        <Link
          to={`/shop/${DEMO_SLUG}/intakes/${DEMO_BRIEF_INTAKE_ID}`}
          className="mt-10 inline-flex items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-ink hover:bg-brand-dim"
        >
          See what the mechanic gets →
        </Link>
      </div>
    </div>
  )
}
