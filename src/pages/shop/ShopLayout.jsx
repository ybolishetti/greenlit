import { useCallback, useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useNavigate, useParams } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import AuthGate from '../../components/AuthGate'
import { getShopBySlug, listShopIntakes, signOut } from '../../lib/db'
import { useAuth } from '../../context/AuthContext'
import { isAdminEmail } from '../../lib/adminAllowlist'

const POLL_INTERVAL_MS = 30000

const NAV_ITEMS = [
  { to: '.', label: 'Overview', end: true },
  { to: 'intakes', label: 'Intakes' },
  { to: 'kit', label: 'Kit' },
  { to: 'team', label: 'Team' },
  { to: 'settings', label: 'Settings' },
]

export default function ShopLayout() {
  const { slug } = useParams()

  return (
    <AuthGate shopSlug={slug}>
      {({ session }) => <ShopLayoutInner slug={slug} session={session} />}
    </AuthGate>
  )
}

function ShopLayoutInner({ slug, session }) {
  const navigate = useNavigate()
  const { shopMemberships, user, loading: authLoading } = useAuth()

  const [shop, setShop] = useState(null)
  const [intakes, setIntakes] = useState([])
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    const shopRow = await getShopBySlug(slug)
    setShop(shopRow)
    try {
      setIntakes(await listShopIntakes(slug))
    } catch (err) {
      console.error('Failed to load intakes:', err)
    }
    setLoaded(true)
  }, [slug])

  useEffect(() => {
    refresh()
    const interval = window.setInterval(refresh, POLL_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [refresh])

  if (authLoading) {
    return <p className="py-20 text-center text-text-dim">Loading…</p>
  }

  const isMember = shopMemberships.some((m) => m.shops?.slug === slug)
  const isAdmin = isAdminEmail(user?.email)

  if (!isMember && !isAdmin) {
    return <Navigate to="/" replace />
  }

  if (loaded && shop?.signup_status === 'suspended') {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-xl font-semibold text-text">Shop suspended</h1>
        <p className="mt-3 text-sm text-text-dim">
          This shop is currently suspended. Contact hello@greenlit.co to restore access.
        </p>
      </div>
    )
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <div className="mx-auto flex max-w-5xl gap-8 px-6 py-12">
      <aside className="w-48 shrink-0">
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Shop dashboard</p>
        <h1 className="mt-1 text-lg font-semibold text-text">{shop?.name || slug}</h1>
        <p className="text-xs text-text-mute">/{slug}</p>

        <nav className="mt-6 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-soft text-brand' : 'text-text-dim hover:text-text'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleSignOut}
          className="mt-8 inline-flex items-center gap-1.5 text-sm text-text-dim hover:text-text"
        >
          <LogOut size={14} /> Sign out
        </button>
        <p className="mt-2 text-xs text-text-mute">{session.user.email}</p>
      </aside>

      <div className="min-w-0 flex-1">
        <Outlet context={{ shop, intakes, refresh, loaded, isAdmin, slug }} />
      </div>
    </div>
  )
}
