import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Zap, ArrowRight, LayoutDashboard } from 'lucide-react'
import { getShopBySlug } from '../lib/db'
import { isSupabaseConfigured } from '../lib/supabase'

export default function ShopLanding() {
  const { shopId: shopSlug } = useParams()
  const intakeUrl = `${window.location.origin}/intake?shop=${shopSlug}`
  const [shop, setShop] = useState(null)

  useEffect(() => {
    if (isSupabaseConfigured) {
      getShopBySlug(shopSlug).then(setShop)
    } else if (shopSlug === 'demo-shop') {
      setShop({ slug: 'demo-shop', name: 'Demo Shop' })
    }
  }, [shopSlug])

  const shopName =
    shop?.name ||
    shopSlug
      .split('-')
      .map((w) => w[0]?.toUpperCase() + w.slice(1))
      .join(' ')

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-brand">
            {shopName} · Greenlit intake
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-text">
            Skip the line. Complete your intake before you're even called up.
          </h1>
          <p className="mt-4 text-text-dim">
            Scan the code, or tap below on your phone at the counter. Takes about 2 minutes — the
            mechanic gets your brief before touching the car.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-text-dim">
            <li className="flex items-center gap-2">
              <Zap size={14} className="text-brand" /> Priority scheduling
            </li>
            <li className="flex items-center gap-2">
              <Zap size={14} className="text-brand" /> Faster turnaround estimate
            </li>
            <li className="flex items-center gap-2">
              <Zap size={14} className="text-brand" /> No app download required to submit
            </li>
          </ul>

          <Link
            to={`/intake?shop=${shopSlug}`}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-ink hover:bg-brand-dim"
          >
            Start my intake
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-panel p-8">
          <div className="rounded-xl bg-white p-4">
            <QRCodeSVG value={intakeUrl} size={180} />
          </div>
          <p className="mt-4 text-center text-xs text-text-mute">
            Displayed at the {shopName} front desk & sent with appointment texts
          </p>
        </div>
      </div>

      <div className="mt-12 border-t border-line/60 pt-6 text-center">
        <Link
          to={`/shop/${shopSlug}/dashboard`}
          className="inline-flex items-center gap-2 text-sm text-text-mute hover:text-text"
        >
          <LayoutDashboard size={14} />
          Shop staff dashboard
        </Link>
      </div>
    </div>
  )
}
