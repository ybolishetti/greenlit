export default function Section({ title, subtitle, bordered, children }) {
  return (
    <div className={`mt-8 ${bordered ? 'rounded-2xl border border-line bg-panel/40 p-5' : ''}`}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-mute">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-text-mute/80">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </div>
  )
}
