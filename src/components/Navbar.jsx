import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import Logo from './Logo'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { signOut } from '../lib/db'
import { useOpenLogin, useStartIntake } from '../hooks/useIntakeAccess'

export default function Navbar() {
  const { isSignedIn, user, shopMemberships } = useAuth()
  const startIntake = useStartIntake()
  const openLogin = useOpenLogin()
  const [menuOpen, setMenuOpen] = useState(false)

  const isShopStaff = shopMemberships.length > 0
  const dashboardPath = isShopStaff ? `/shop/${shopMemberships[0].shops.slug}` : null

  const displayName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email ??
    'Account'

  const handleSignOut = async () => {
    setMenuOpen(false)
    if (!isSupabaseConfigured) return
    try {
      await signOut()
    } catch (err) {
      console.error('Sign out failed:', err)
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-ink/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/">
          <Logo />
        </Link>
        <nav className="flex items-center gap-6 text-sm text-white/70 sm:gap-8">
          {!isShopStaff && (
            <Link to="/for-shops" className="hidden hover:text-white transition-colors sm:inline">
              For shops
            </Link>
          )}

          {isSignedIn ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-sm text-white hover:border-brand/50"
              >
                <User size={14} className="text-brand" />
                <span className="max-w-[140px] truncate">{displayName}</span>
              </button>
              {menuOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close menu"
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 z-50 mt-2 w-44 rounded-xl border border-line bg-panel py-1 shadow-lg">
                    <Link
                      to={isShopStaff ? dashboardPath : '/account'}
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-text hover:bg-line/40"
                    >
                      {isShopStaff ? 'Shop dashboard' : 'My intakes'}
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-text hover:bg-line/40"
                    >
                      <LogOut size={14} />
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={openLogin}
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Log in
            </button>
          )}

          {isShopStaff ? (
            <Link
              to={dashboardPath}
              className="ml-1 rounded-full bg-brand px-5 py-2 font-medium text-ink hover:bg-brand-dim transition-colors sm:ml-2"
            >
              Go to dashboard
            </Link>
          ) : (
            <button
              type="button"
              onClick={startIntake}
              className="ml-1 rounded-full bg-brand px-5 py-2 font-medium text-ink hover:bg-brand-dim transition-colors sm:ml-2"
            >
              Start intake
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}
