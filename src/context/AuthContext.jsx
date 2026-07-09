import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  claimAnonymousIntake,
  getSession,
  onAuthStateChange,
  upsertConsumerProfile,
} from '../lib/db'
import { claimPendingShopMemberships, getShopMembershipsForUser } from '../lib/db/shopMembership'
import { consumePendingClaim, consumePostAuthRedirect, getOrCreateDeviceId } from '../lib/deviceId'
import AuthModal from '../components/auth/AuthModal'
import Toast from '../components/Toast'

const AuthContext = createContext(null)

const SHOP_SCOPED_PREFIXES = ['/shop/', '/intake', '/i/', '/admin']

function redirectShopMemberIfNeeded(navigate, memberships) {
  if (!memberships.length) return
  const path = window.location.pathname
  if (SHOP_SCOPED_PREFIXES.some((prefix) => path.startsWith(prefix))) return
  navigate(`/shop/${memberships[0].shops.slug}`)
}

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null)
  const [shopMemberships, setShopMemberships] = useState([])
  const modalRef = useRef(null)

  modalRef.current = modal

  const showToast = useCallback((message) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3500)
  }, [])

  const closeAuthModal = useCallback(() => {
    setModal(null)
  }, [])

  const openAuthModal = useCallback((options = {}) => {
    setModal(options)
  }, [])

  useEffect(() => {
    getOrCreateDeviceId()

    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    getSession()
      .then(async (s) => {
        setSession(s)
        if (s?.user) {
          try {
            await claimPendingShopMemberships()
          } catch (err) {
            console.warn('Failed to claim pending shop memberships:', err)
          }
          const memberships = await getShopMembershipsForUser(s.user.id).catch(() => [])
          setShopMemberships(memberships)
          redirectShopMemberIfNeeded(navigate, memberships)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))

    const subscription = onAuthStateChange(async (event, nextSession) => {
      setSession(nextSession)

      if (!nextSession?.user) {
        setShopMemberships([])
      }

      if (event === 'SIGNED_IN' && nextSession?.user) {
        try {
          await claimPendingShopMemberships()
        } catch (err) {
          console.warn('Failed to claim pending shop memberships:', err)
        }

        const memberships = await getShopMembershipsForUser(nextSession.user.id).catch(() => [])
        setShopMemberships(memberships)

        if (memberships.length > 0) {
          redirectShopMemberIfNeeded(navigate, memberships)
          modalRef.current?.onAuthSuccess?.()
          setModal(null)
          return
        }

        try {
          await upsertConsumerProfile(nextSession.user)
        } catch (err) {
          console.error('Failed to upsert consumer profile:', err)
        }

        const pendingClaim = consumePendingClaim()
        if (pendingClaim) {
          try {
            await claimAnonymousIntake(pendingClaim.deviceId, pendingClaim.intakeId)
            sessionStorage.setItem(`greenlit_claimed_${pendingClaim.intakeId}`, '1')
            showToast('Saved to your account')
            modalRef.current?.onClaimSuccess?.()
          } catch (err) {
            console.error('Failed to claim intake:', err)
          }
        }

        const redirect = consumePostAuthRedirect()
        if (redirect) {
          navigate(redirect)
        }

        modalRef.current?.onAuthSuccess?.()
        setModal(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate, showToast])

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    isSignedIn: Boolean(session?.user),
    shopMemberships,
    openAuthModal,
    closeAuthModal,
    showToast,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
      {modal && (
        <AuthModal
          mode={modal.mode ?? 'start'}
          disableSkip={modal.disableSkip ?? false}
          onClose={() => {
            modal.onClose?.()
            closeAuthModal()
          }}
          onSkip={() => {
            modal.onSkip?.()
            closeAuthModal()
          }}
          onBeforeOAuth={modal.onBeforeOAuth}
        />
      )}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
