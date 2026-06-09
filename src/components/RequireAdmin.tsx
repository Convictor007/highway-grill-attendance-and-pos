import { Navigate } from 'react-router-dom'
import { LoadingBlock } from './LoadingBlock'
import { useAuth } from '../context/AuthContext'
import { isSystemAdmin } from '../lib/roles'

type Props = {
  children: React.ReactNode
}

export function RequireAdmin({ children }: Props) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingBlock />
  if (!isSystemAdmin(user)) return <Navigate to="/" replace />
  return <>{children}</>
}
