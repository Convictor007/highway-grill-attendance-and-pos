import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canUseEmployeeFeatures } from '../lib/accountStatus'

export function RequireActiveEmployee({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!canUseEmployeeFeatures(user)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
