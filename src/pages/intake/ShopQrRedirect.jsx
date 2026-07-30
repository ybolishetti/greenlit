import { Navigate, useParams } from 'react-router-dom'
import { isDemoShop } from '../../lib/demoShop'
import DemoIntakePreview from './DemoIntakePreview'

// Short, scan-optimized QR target. Reuses the fully-working /intake?shop=
// flow end to end — no separate customer-facing page to maintain.
export default function ShopQrRedirect() {
  const { slug } = useParams()
  if (isDemoShop(slug)) return <DemoIntakePreview />
  return <Navigate to={`/intake?shop=${encodeURIComponent(slug)}`} replace />
}
