import { useOutletContext } from 'react-router-dom'

export default function SettingsTab() {
  const { shop } = useOutletContext()

  if (!shop) {
    return <p className="text-sm text-text-dim">Loading…</p>
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-text">Settings</h2>
      <div className="mt-6 max-w-md space-y-2">
        <SettingsRow label="Shop name" value={shop.name} />
        <SettingsRow label="Slug" value={shop.slug} />
        <SettingsRow label="Address" value={shop.address || '—'} />
        <SettingsRow label="Contact email" value={shop.contact_email || '—'} />
        <SettingsRow label="Contact phone" value={shop.contact_phone || '—'} />
        <SettingsRow label="Timezone" value={shop.timezone || '—'} />
        <SettingsRow label="Plan" value={shop.plan || 'Not yet assigned'} />
        <p className="pt-3 text-sm text-text-mute">To change these, contact Greenlit support.</p>
      </div>
    </div>
  )
}

function SettingsRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3">
      <span className="text-xs uppercase tracking-wide text-text-mute">{label}</span>
      <span className="text-sm text-text">{value}</span>
    </div>
  )
}
