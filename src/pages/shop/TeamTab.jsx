import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Trash2, X } from 'lucide-react'
import { getShopMembersWithEmail, removeShopMember } from '../../lib/db/shopMembership'
import { useAuth } from '../../context/AuthContext'

const SALES_EMAIL = import.meta.env.VITE_SALES_EMAIL || 'hello@greenlit.co'

export default function TeamTab() {
  const { shop } = useOutletContext()
  const { user, shopMemberships } = useAuth()
  const [members, setMembers] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(null)
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

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleRemove = async (userId) => {
    if (!shop?.id) return
    await removeShopMember(shop.id, userId)
    refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-text">Team</h2>
        <button
          onClick={() => setInviteOpen(true)}
          className="rounded-lg bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/20"
        >
          Invite teammate
        </button>
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

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}
    </div>
  )
}

function InviteModal({ onClose }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

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
            During beta, email your teammate's address to{' '}
            <strong className="text-text">{SALES_EMAIL}</strong> and we'll add them. Self-serve
            invites coming soon.
          </p>
        ) : (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@shop.com"
              className="mt-4 w-full rounded-xl border border-line bg-ink/40 p-3 text-sm text-text focus:border-brand/50 focus:outline-none"
            />
            <button
              onClick={() => setSent(true)}
              className="mt-4 w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-ink hover:bg-brand-dim"
            >
              Send invite
            </button>
          </>
        )}
      </div>
    </div>
  )
}
