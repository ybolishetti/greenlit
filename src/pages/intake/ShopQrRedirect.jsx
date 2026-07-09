import { Navigate, useParams } from 'react-router-dom'

// Short, scan-optimized QR target. Reuses the fully-working /intake?shop=
// flow end to end — no separate customer-facing page to maintain.
export default function ShopQrRedirect() {
  const { slug } = useParams()
  return <Navigate to={`/intake?shop=${encodeURIComponent(slug)}`} replace />
}
