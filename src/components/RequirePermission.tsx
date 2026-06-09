import { Navigate } from 'react-router-dom'
import { LoadingBlock } from './LoadingBlock'
import { useAuth } from '../context/AuthContext'
import { hasPermission } from '../lib/auth'

type Props = {
  permission: string | string[]
  children: React.ReactNode
}

export function RequirePermission({ permission, children }: Props) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingBlock />
  const perms = Array.isArray(permission) ? permission : [permission]
  if (!user || !perms.some((p) => hasPermission(user, p))) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
