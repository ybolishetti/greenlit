import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Trash2, X } from 'lucide-react'
import { getShopMembersWithEmail, removeShopMember } from '../../lib/db/shopMembership'
import { invite, listPending, revokePending } from '../../lib/db/pendingShopMembers'
import { useAuth } from '../../context/AuthContext'

export default function TeamTab() {
  const { shop } = useOutletContext()
  const { user, shopMemberships } = useAuth()
  const [members, setMembers] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState([])
  const [inviteOpen, setInviteOpen] = useState(false)

  const myRole = shopMemberships.find((m) => m.shops?.slug === shop?.slug)?.role
  const isOwner = myRole === 'owner'

  const refresh = useCallback(async () => {
    if (!shop?.id) return
    try {
      const rows = await getShopMembersWithEmail(shop.id)
      setMembers(rows)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoaded(true)
    }
  }, [shop?.id])

  const refreshPending = useCallback(async () => {
    if (!shop?.id || !isOwner) return
    try {
      setPending(await listPending(shop.id))
    } catch (err) {
      setError(err.message)
    }
  }, [shop?.id, isOwner])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    refreshPending()
  }, [refreshPending])

  const handleRemove = async (userId) => {
    if (!shop?.id) return
    await removeShopMember(shop.id, userId)
    refresh()
  }

  const handleRevoke = async (id) => {
    await revokePending(id)
    refreshPending()
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-text">Team</h2>
        {isOwner && (
          <button
            onClick={() => setInviteOpen(true)}
            className="rounded-lg bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/20"
          >
            Invite teammate
          </button>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-4 space-y-2">
        {members.map((m) => (
          <div
            key={m.user_id}
            className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3"
          >
            <div>
              <p className="text-sm text-text">{m.email}</p>
              <p className="text-xs capitalize text-text-mute">{m.role}</p>
            </div>
            {isOwner && m.user_id !== user?.id && (
              <button
                onClick={() => handleRemove(m.user_id)}
                className="inline-flex items-center gap-1 text-xs text-danger hover:underline"
              >
                <Trash2 size={13} /> Remove
              </button>
            )}
          </div>
        ))}
        {loaded && members.length === 0 && (
          <p className="text-sm text-text-dim">No team members found.</p>
        )}
      </div>

      {isOwner && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-mute">
            Pending invites
          </h3>
          <div className="mt-3 space-y-2">
            {pending.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3"
              >
                <div>
                  <p className="text-sm text-text">{p.email}</p>
                  <p className="text-xs capitalize text-text-mute">{p.role}</p>
                </div>
                <button
                  onClick={() => handleRevoke(p.id)}
                  className="inline-flex items-center gap-1 text-xs text-danger hover:underline"
                >
                  <Trash2 size={13} /> Revoke
                </button>
              </div>
            ))}
            {pending.length === 0 && <p className="text-sm text-text-dim">No pending invites.</p>}
          </div>
        </div>
      )}

      {inviteOpen && (
        <InviteModal
          shopId={shop.id}
          isOwner={isOwner}
          onClose={() => setInviteOpen(false)}
          onInvited={refreshPending}
        />
      )}
    </div>
  )
}

function InviteModal({ shopId, isOwner, onClose, onInvited }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      await invite(shopId, email, role)
      setSent(true)
      onInvited?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-text">Invite teammate</h3>
          <button onClick={onClose} className="text-text-mute hover:text-text">
            <X size={16} />
          </button>
        </div>
        {sent ? (
          <p className="mt-4 text-sm text-text-dim">
            Invite ready. Tell your teammate to sign in with Google using{' '}
            <strong className="text-text">{email}</strong> — they'll land in this dashboard
            automatically.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@shop.com"
              className="mt-4 w-full rounded-xl border border-line bg-ink/40 p-3 text-sm text-text focus:border-brand/50 focus:outline-none"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={!isOwner}
              className="mt-3 w-full rounded-xl border border-line bg-ink/40 p-3 text-sm text-text disabled:opacity-50"
            >
              <option value="member">Member</option>
              <option value="owner">Owner</option>
            </select>
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={sending}
              className="mt-4 w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-ink hover:bg-brand-dim disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send invite'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
