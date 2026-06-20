import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canAccessLeavePage } from '../lib/accountStatus'

export function RequireLeaveAccess({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!canAccessLeavePage(user)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
