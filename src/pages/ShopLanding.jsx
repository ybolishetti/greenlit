import { useParams, Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Zap, ArrowRight, LayoutDashboard } from 'lucide-react'

export default function ShopLanding() {
  const { shopId } = useParams()
  const intakeUrl = `${window.location.origin}/intake?shop=${shopId}`
  const shopName = shopId
    .split('-')
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ')

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-lime">
            {shopName} · Greenlit intake
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Skip the line. Complete your intake before you're even called up.
          </h1>
          <p className="mt-4 text-white/60">
            Scan the code, or tap below on your phone at the counter. Takes
            about 2 minutes — the mechanic gets your brief before touching
            the car.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-white/60">
            <li className="flex items-center gap-2">
              <Zap size={14} className="text-lime" /> Priority scheduling
            </li>
            <li className="flex items-center gap-2">
              <Zap size={14} className="text-lime" /> Faster turnaround estimate
            </li>
            <li className="flex items-center gap-2">
              <Zap size={14} className="text-lime" /> No app download required to submit
            </li>
          </ul>

          <Link
            to={`/intake?shop=${shopId}`}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-lime px-6 py-3 text-sm font-semibold text-ink hover:bg-lime-dim transition-colors"
          >
            Start my intake
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-panel p-8">
          <div className="rounded-xl bg-white p-4">
            <QRCodeSVG value={intakeUrl} size={180} />
          </div>
          <p className="mt-4 text-center text-xs text-white/40">
            Displayed at the {shopName} front desk & sent with appointment texts
          </p>
        </div>
      </div>

      <div className="mt-12 border-t border-line/60 pt-6 text-center">
        <Link
          to={`/shop/${shopId}/dashboard`}
          className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white"
        >
          <LayoutDashboard size={14} />
          Shop staff dashboard
        </Link>
      </div>
    </div>
  )
}
