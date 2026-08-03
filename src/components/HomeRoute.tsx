import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isEmployeePortal, isPendingEmployee } from '../lib/accountStatus'
import { isSuperAdmin, isSystemAdmin } from '../lib/roles'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import { EmployeeHomePage } from '../pages/home/EmployeeHomePage'
import { PendingEmployeeHomePage } from '../pages/home/PendingEmployeeHomePage'

export function HomeRoute() {
  const { user } = useAuth()
  if (isPendingEmployee(user)) return <PendingEmployeeHomePage />
  if (isEmployeePortal(user)) return <EmployeeHomePage />
  if (isSystemAdmin(user)) return <Navigate to="/admin" replace />
  if (isSuperAdmin(user)) return <Navigate to="/security" replace />
  return <DashboardPage />
}
