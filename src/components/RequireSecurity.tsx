import { Navigate } from 'react-router-dom'
import { LoadingBlock } from './LoadingBlock'
import { useAuth } from '../context/AuthContext'
import { hasPermission } from '../lib/auth'

type Props = {
  children: React.ReactNode
}

export function RequireSecurity({ children }: Props) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingBlock />
  if (!hasPermission(user, 'security.view')) return <Navigate to="/" replace />
  return <>{children}</>
}
