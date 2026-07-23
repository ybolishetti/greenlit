import { Link } from 'react-router-dom'
import { Mic, Camera, SlidersHorizontal, MessageSquareText, ArrowRight, ShieldCheck } from 'lucide-react'
import DownloadAppButton from '../components/DownloadAppButton'
import { useOpenLogin, useStartIntake } from '../hooks/useIntakeAccess'
import { useAuth } from '../context/AuthContext'

const MODALITIES = [
  { icon: Mic, title: 'Audio', desc: 'Record the noise right in your browser, or upload a clip.' },
  { icon: Camera, title: 'Photo / video', desc: 'Show visible damage, leaks, tire wear, or dashboard lights.' },
  { icon: MessageSquareText, title: 'Guided questions', desc: 'No jargon — plain-language branching questions.' },
  { icon: SlidersHorizontal, title: 'Feel', desc: 'Sliders for pedal stiffness, steering resistance, vibration.' },
]

const STEPS = [
  { title: 'Describe what happened', desc: 'Record or upload audio, add a photo, and answer a few guided questions.' },
  { title: 'Get a mechanic brief', desc: 'Ranked probable causes, urgency rating, and components to inspect first — in plain language.' },
  { title: 'Bring it to a shop', desc: 'Share the brief at drop-off, or scan a shop QR code for priority intake.' },
]

export default function Landing() {
  const startIntake = useStartIntake()
  const openLogin = useOpenLogin()
  const { isSignedIn, shopMemberships } = useAuth()
  const isShopStaff = shopMemberships.length > 0
  const dashboardPath = isShopStaff ? `/shop/${shopMemberships[0].shops.slug}` : null

  return (
    <div>
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
        <p className="text-sm font-medium tracking-wide text-brand uppercase">speak mechanic.</p>
        <h1 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight text-white">
          Tell us what your car is doing.
          <br />
          We'll translate it for the mechanic.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60">
          Greenlit turns "it makes a weird noise when I turn" into a precise,
          mechanic-ready diagnostic brief — audio, photo, and feel, no
          technical language required.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          {isShopStaff ? (
            <Link
              to={dashboardPath}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-ink hover:bg-brand-dim transition-colors"
            >
              Go to dashboard
              <ArrowRight size={16} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={startIntake}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-ink hover:bg-brand-dim transition-colors"
            >
              Start intake
              <ArrowRight size={16} />
            </button>
          )}
          {!isSignedIn && (
            <button
              type="button"
              onClick={openLogin}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel px-6 py-3 text-sm font-medium text-white hover:border-brand/50 transition-colors"
            >
              Log in
            </button>
          )}
          <DownloadAppButton />
        </div>
        <p className="mt-4 text-xs text-white/40">
          Works entirely in your browser — no download required for a full mechanic brief.
        </p>
      </section>

      <section className="border-t border-line/60 bg-panel/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-center text-2xl font-semibold text-white">
            Four ways to describe the problem
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-white/50">
            No single input is load-bearing — capture what you can, in whatever form is easiest.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {MODALITIES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-line bg-panel p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10">
                  <Icon size={18} className="text-brand" />
                </div>
                <h3 className="mt-4 font-medium text-white">{title}</h3>
                <p className="mt-1 text-sm text-white/50">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold text-white">How it works</h2>
        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl border border-line bg-panel p-6">
              <span className="text-3xl font-semibold text-brand/40">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-3 font-medium text-white">{s.title}</h3>
              <p className="mt-1 text-sm text-white/50">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line/60 bg-panel/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/10">
            <ShieldCheck size={20} className="text-brand" />
          </div>
          <h2 className="text-2xl font-semibold text-white">A triage tool, not a diagnosis</h2>
          <p className="max-w-xl text-white/50">
            Greenlit gives the mechanic a head start, not a verdict. The
            mechanic's judgment is always final — Greenlit just makes sure
            they're starting from the full story instead of a vague
            description from memory.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 text-center">
        <h2 className="text-2xl font-semibold text-white">Run a repair shop?</h2>
        <p className="mx-auto mt-2 max-w-xl text-white/50">
          Greenlit gives your customers a QR code at drop-off. Every intake arrives structured,
          ranked, and ready — before the car hits your bay.
        </p>
        <Link
          to="/for-shops"
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-line bg-panel px-5 py-3 text-sm font-medium text-white hover:border-brand/50 transition-colors"
        >
          For repair shops
          <ArrowRight size={16} />
        </Link>
      </section>
    </div>
  )
}
