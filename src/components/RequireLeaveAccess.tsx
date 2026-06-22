import { Navigate } from 'react-router-dom'
import { LoadingBlock } from './LoadingBlock'
import { useAuth } from '../context/AuthContext'
import { hasPermission } from '../lib/auth'
import { canUseEmployeeFeatures, isEmployeePortal } from '../lib/accountStatus'

/** Crew need active account; HR/staff use leave management without an employee record. */
export function RequireLeaveAccess({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingBlock />

  const staffLeave =
    !isEmployeePortal(user) &&
    (hasPermission(user, 'leave.view') ||
      hasPermission(user, 'leave.approve') ||
      hasPermission(user, 'leave.manage'))

  const employeeLeave =
    isEmployeePortal(user) &&
    canUseEmployeeFeatures(user) &&
    (hasPermission(user, 'leave.view') || hasPermission(user, 'leave.apply'))

  if (staffLeave || employeeLeave) return <>{children}</>
  return <Navigate to="/" replace />
}
