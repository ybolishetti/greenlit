export default function DemoBanner({ variant = 'shop' }) {
  const message =
    variant === 'shop'
      ? "You're viewing a demo shop with fake data. In production, this is your live dashboard."
      : "This is a demo intake. Nothing you submit is saved."
  return (
    <div className="border-b border-brand/30 bg-brand-soft px-6 py-3 text-center text-sm text-brand">
      {message}
    </div>
  )
}
