import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAuthModalModeForIntakeStart, setPostAuthRedirect } from '../lib/deviceId'

export function useStartIntake() {
  const navigate = useNavigate()
  const { isSignedIn, openAuthModal } = useAuth()

  return () => {
    if (isSignedIn) {
      navigate('/intake')
      return
    }

    const mode = getAuthModalModeForIntakeStart()
    openAuthModal({
      mode,
      disableSkip: mode === 'limit',
      onSkip: () => navigate('/intake'),
      onBeforeOAuth: () => setPostAuthRedirect('/intake'),
    })
  }
}

export function useOpenLogin() {
  const { openAuthModal } = useAuth()
  return () => openAuthModal({ mode: 'login', disableSkip: true })
}
