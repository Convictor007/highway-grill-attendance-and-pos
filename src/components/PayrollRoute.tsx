import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { hasPermission } from '../lib/auth'
import { canUseEmployeeFeatures } from '../lib/accountStatus'
import { isSystemAdmin } from '../lib/roles'
import { PayrollPage } from '../pages/payroll/PayrollPage'
import { MyPayslipsPage } from '../pages/payroll/MyPayslipsPage'

export function PayrollRoute() {
  const { user } = useAuth()
  if (isSystemAdmin(user)) return <Navigate to="/admin" replace />
  if (hasPermission(user, 'payroll.view')) return <PayrollPage />
  if (hasPermission(user, 'payroll.view.self')) {
    if (!canUseEmployeeFeatures(user)) return <Navigate to="/" replace />
    return <MyPayslipsPage />
  }
  return <Navigate to="/" replace />
}
