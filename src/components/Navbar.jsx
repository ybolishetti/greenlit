import { Link } from 'react-router-dom'
import Logo from './Logo'

export default function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-ink/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/">
          <Logo />
        </Link>
        <nav className="flex items-center gap-6 text-sm text-white/70">
          <Link to="/intake" className="hover:text-white transition-colors">
            Report a problem
          </Link>
          <Link to="/shop/demo-shop" className="hover:text-white transition-colors">
            For shops
          </Link>
          <Link
            to="/intake"
            className="rounded-full bg-brand px-4 py-2 font-medium text-ink hover:bg-brand-dim transition-colors"
          >
            Start intake
          </Link>
        </nav>
      </div>
    </header>
  )
}
