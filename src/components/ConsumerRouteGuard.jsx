import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// Shop-role users have no business submitting consumer intakes. Gates
// /intake, /intake/:id, /account, /account/:id behind role. Gate on
// `loading` first so we never render consumer content before shop
// membership status is known, then flash-redirect.
export default function ConsumerRouteGuard({ children }) {
  const { loading, shopMemberships } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-text-dim">
        <Loader2 className="animate-spin" size={18} />
      </div>
    )
  }

  if (shopMemberships.length > 0) {
    return <Navigate to={`/shop/${shopMemberships[0].shops.slug}`} replace />
  }

  return children
}
