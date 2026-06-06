import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { hasPermission } from '../lib/auth'
import { PayrollPage } from '../pages/payroll/PayrollPage'
import { MyPayslipsPage } from '../pages/payroll/MyPayslipsPage'

export function PayrollRoute() {
  const { user } = useAuth()
  if (hasPermission(user, 'payroll.view')) return <PayrollPage />
  if (hasPermission(user, 'payroll.view.self')) return <MyPayslipsPage />
  return <Navigate to="/" replace />
}
