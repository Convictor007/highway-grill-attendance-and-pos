import { useAuth } from '../context/AuthContext'
import { isEmployeePortal } from '../lib/accountStatus'
import { AdminLayout } from './AdminLayout'
import { EmployeeLayout } from './EmployeeLayout'

export function DashboardLayout() {
  const { user } = useAuth()
  return isEmployeePortal(user) ? <EmployeeLayout /> : <AdminLayout />
}
