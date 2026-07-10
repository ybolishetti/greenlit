import { useCallback, useEffect, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { isAdminEmail } from '../../lib/adminAllowlist'
import { convertLeadToShop, listLeads, updateLeadStatus } from '../../lib/db/shopLeads'
import {
  createShop,
  listShopsWithMemberCounts,
  updateShop,
  updateShopSignupStatus,
} from '../../lib/db/shops'
import { getShopMembersWithEmail } from '../../lib/db/shopMembership'
import { invite, listPending, revokePending } from '../../lib/db/pendingShopMembers'
import { isSupabaseConfigured } from '../../lib/supabase'

const LEAD_STATUSES = ['new', 'contacted', 'pilot', 'active', 'churned', 'rejected']
const PLAN_OPTIONS = ['', 'pilot', 'standard', 'growth', 'high_volume']

const inputClass =
  'w-full rounded-lg border border-line bg-ink/40 p-2.5 text-sm text-text focus:border-brand/50 focus:outline-none'

export default function AdminShops() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="px-6 py-20 text-center text-text-dim">Loading…</div>
  }

  if (!isSupabaseConfigured || !isAdminEmail(user?.email)) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center text-text-dim">Not authorized.</div>
    )
  }

  return <AdminShopsPanel />
}

function AdminShopsPanel() {
  const [leads, setLeads] = useState([])
  const [shops, setShops] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(null)
  const [managingShop, setManagingShop] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const [leadRows, shopRows] = await Promise.all([listLeads(), listShopsWithMemberCounts()])
      setLeads(leadRows)
      setShops(shopRows)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleStatusChange = async (id, status) => {
    await updateLeadStatus(id, status)
    refresh()
  }

  const handleMarkReviewed = async (id) => {
    await updateShopSignupStatus(id, 'active')
    refresh()
  }

  const handleSuspend = async (id) => {
    await updateShopSignupStatus(id, 'suspended')
    refresh()
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-text">Admin — Shops</h1>
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <LeadsSection leads={leads} loaded={loaded} onStatusChange={handleStatusChange} />
      <ShopsSection
        shops={shops}
        loaded={loaded}
        onManage={setManagingShop}
        onMarkReviewed={handleMarkReviewed}
        onSuspend={handleSuspend}
      />
      <ProvisionSection leads={leads} onProvisioned={refresh} />

      {managingShop && (
        <ManageShopDrawer
          shop={managingShop}
          onClose={() => setManagingShop(null)}
          onSaved={refresh}
        />
      )}
    </div>
  )
}

function LeadsSection({ leads, loaded, onStatusChange }) {
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-mute">Inbound leads</h2>
      <div className="mt-4 overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-panel/60 text-left text-xs uppercase text-text-mute">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Shop</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Email / phone</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Est. intakes</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b border-line/60">
                <td className="whitespace-nowrap px-4 py-3 text-text-dim">
                  {new Date(lead.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-text">{lead.shop_name}</td>
                <td className="px-4 py-3 text-text-dim">{lead.contact_name}</td>
                <td className="px-4 py-3 text-text-dim">
                  <div>{lead.contact_email}</div>
                  {lead.contact_phone && <div className="text-xs">{lead.contact_phone}</div>}
                </td>
                <td className="px-4 py-3 text-text-dim">{lead.location || '—'}</td>
                <td className="px-4 py-3 text-text-dim">{lead.monthly_intakes || '—'}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-panel px-2 py-1 text-xs capitalize text-text">
                    {lead.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={lead.status}
                    onChange={(e) => onStatusChange(lead.id, e.target.value)}
                    className="rounded-lg border border-line bg-panel px-2 py-1 text-xs text-text"
                  >
                    {LEAD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loaded && leads.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-text-dim">No leads yet.</p>
        )}
      </div>
    </section>
  )
}

function ShopsSection({ shops, loaded, onManage, onMarkReviewed, onSuspend }) {
  const sortedShops = [...shops].sort((a, b) => {
    const aPending = a.signup_status === 'pending_review' ? 0 : 1
    const bPending = b.signup_status === 'pending_review' ? 0 : 1
    if (aPending !== bPending) return aPending - bPending
    return new Date(b.created_at) - new Date(a.created_at)
  })

  return (
    <section className="mt-12">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-mute">Active shops</h2>
      <div className="mt-4 space-y-2">
        {sortedShops.map((shop) => (
          <div
            key={shop.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-text">
                  {shop.name} <span className="text-text-mute">/{shop.slug}</span>
                </p>
                {shop.signup_status === 'pending_review' && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                    Pending review
                  </span>
                )}
                {shop.signup_status === 'suspended' && (
                  <span className="rounded-full bg-danger/20 px-2 py-0.5 text-xs font-medium text-danger">
                    Suspended
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    shop.signup_source === 'self_serve'
                      ? 'bg-brand/20 text-brand'
                      : 'bg-line/60 text-text-mute'
                  }`}
                >
                  {shop.signup_source === 'self_serve' ? 'Self-serve' : 'Admin'}
                </span>
              </div>
              <p className="text-xs text-text-mute">
                {shop.memberCount} member{shop.memberCount === 1 ? '' : 's'} · {shop.plan || 'no plan'}{' '}
                · created {new Date(shop.created_at).toLocaleDateString()}
                {shop.signup_source === 'self_serve' && shop.created_by_email && (
                  <> · created by {shop.created_by_email}</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {shop.signup_status === 'pending_review' && (
                <button
                  onClick={() => onMarkReviewed(shop.id)}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-text hover:border-brand/50"
                >
                  Mark reviewed
                </button>
              )}
              {shop.signup_status !== 'suspended' ? (
                <button
                  onClick={() => onSuspend(shop.id)}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-danger hover:border-danger/50"
                >
                  Suspend
                </button>
              ) : (
                <button
                  onClick={() => onMarkReviewed(shop.id)}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-text hover:border-brand/50"
                >
                  Reinstate
                </button>
              )}
              <button
                onClick={() => onManage(shop)}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-text hover:border-brand/50"
              >
                Manage
              </button>
            </div>
          </div>
        ))}
        {loaded && shops.length === 0 && <p className="text-sm text-text-dim">No shops yet.</p>}
      </div>
    </section>
  )
}

function ManageShopDrawer({ shop, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: shop.name || '',
    plan: shop.plan || '',
    address: shop.address || '',
    contact_email: shop.contact_email || '',
    contact_phone: shop.contact_phone || '',
    timezone: shop.timezone || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [members, setMembers] = useState([])
  const [pending, setPending] = useState([])
  const [rosterLoaded, setRosterLoaded] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState(null)

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await updateShop(shop.id, { ...form, plan: form.plan || null })
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const refreshRoster = useCallback(async () => {
    try {
      const [memberRows, pendingRows] = await Promise.all([
        getShopMembersWithEmail(shop.id),
        listPending(shop.id),
      ])
      setMembers(memberRows)
      setPending(pendingRows)
    } catch (err) {
      setInviteError(err.message)
    } finally {
      setRosterLoaded(true)
    }
  }, [shop.id])

  useEffect(() => {
    refreshRoster()
  }, [refreshRoster])

  const handleInvite = async (e) => {
    e.preventDefault()
    setInviting(true)
    setInviteError(null)
    try {
      await invite(shop.id, inviteEmail, inviteRole)
      setInviteEmail('')
      setInviteRole('member')
      await refreshRoster()
    } catch (err) {
      setInviteError(err.message)
    } finally {
      setInviting(false)
    }
  }

  const handleRevoke = async (id) => {
    await revokePending(id)
    refreshRoster()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/70" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text">Manage {shop.name}</h3>
          <button onClick={onClose} className="text-text-mute hover:text-text">
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 space-y-3">
          <AdminField label="Name">
            <input value={form.name} onChange={update('name')} className={inputClass} />
          </AdminField>
          <AdminField label="Slug (read-only — changing it breaks QR codes)">
            <input value={shop.slug} disabled className={`${inputClass} opacity-50`} />
          </AdminField>
          <AdminField label="Plan">
            <select value={form.plan} onChange={update('plan')} className={inputClass}>
              {PLAN_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p || 'No plan'}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField label="Address">
            <input value={form.address} onChange={update('address')} className={inputClass} />
          </AdminField>
          <AdminField label="Contact email">
            <input value={form.contact_email} onChange={update('contact_email')} className={inputClass} />
          </AdminField>
          <AdminField label="Contact phone">
            <input value={form.contact_phone} onChange={update('contact_phone')} className={inputClass} />
          </AdminField>
          <AdminField label="Timezone">
            <input value={form.timezone} onChange={update('timezone')} className={inputClass} />
          </AdminField>
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-6 w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-ink hover:bg-brand-dim disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>

        <div className="mt-8 space-y-6">
          <div>
            <h4 className="text-sm font-medium text-text">Members</h4>
            <div className="mt-2 space-y-2">
              {members.map((m) => (
                <div
                  key={m.user_id}
                  className="flex items-center justify-between rounded-lg border border-line bg-ink/30 px-3 py-2 text-sm"
                >
                  <span className="text-text">{m.email}</span>
                  <span className="text-xs capitalize text-text-mute">{m.role}</span>
                </div>
              ))}
              {rosterLoaded && members.length === 0 && (
                <p className="text-sm text-text-dim">No members yet.</p>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-text">Pending invites</h4>
            <div className="mt-2 space-y-2">
              {pending.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-line bg-ink/30 px-3 py-2 text-sm"
                >
                  <div>
                    <span className="text-text">{p.email}</span>
                    <span className="ml-2 text-xs capitalize text-text-mute">{p.role}</span>
                  </div>
                  <button
                    onClick={() => handleRevoke(p.id)}
                    className="text-text-mute hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {rosterLoaded && pending.length === 0 && (
                <p className="text-sm text-text-dim">No pending invites.</p>
              )}
            </div>
          </div>

          <form onSubmit={handleInvite} className="rounded-xl border border-line bg-ink/30 p-4">
            <h4 className="text-sm font-medium text-text">Add member</h4>
            <div className="mt-3 flex gap-2">
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@shop.com"
                className={inputClass}
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className={inputClass}
              >
                <option value="member">Member</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            {inviteError && <p className="mt-2 text-sm text-danger">{inviteError}</p>}
            <button
              type="submit"
              disabled={inviting}
              className="mt-3 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brand-dim disabled:opacity-50"
            >
              {inviting ? 'Sending…' : 'Send invite'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function ProvisionSection({ leads, onProvisioned }) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [leadId, setLeadId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const convertibleLeads = leads.filter((l) => !l.converted_shop_id)

  const handleNameChange = (e) => {
    const value = e.target.value
    setName(value)
    if (!slugEdited) setSlug(slugify(value))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!name.trim() || !slug.trim()) {
      setError('Shop name and slug are required')
      return
    }
    setSaving(true)
    try {
      const shop = await createShop({ name: name.trim(), slug: slug.trim() })
      if (leadId) {
        await convertLeadToShop(leadId, shop.id)
      }
      setName('')
      setSlug('')
      setSlugEdited(false)
      setLeadId('')
      setSuccess(true)
      onProvisioned()
      window.setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-12">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-mute">
        Provision new shop
      </h2>
      <form onSubmit={handleSubmit} className="mt-4 max-w-md space-y-3">
        <AdminField label="Shop name">
          <input value={name} onChange={handleNameChange} className={inputClass} />
        </AdminField>
        <AdminField label="Slug">
          <input
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value)
              setSlugEdited(true)
            }}
            className={inputClass}
          />
        </AdminField>
        <AdminField label="Convert from lead (optional)">
          <select value={leadId} onChange={(e) => setLeadId(e.target.value)} className={inputClass}>
            <option value="">None</option>
            {convertibleLeads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.shop_name} — {l.contact_email}
              </option>
            ))}
          </select>
        </AdminField>
        {error && <p className="text-sm text-danger">{error}</p>}
        {success && <p className="text-sm text-brand">Shop provisioned.</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-ink hover:bg-brand-dim disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create shop'}
        </button>
      </form>
    </section>
  )
}

function AdminField({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-text-mute">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}
