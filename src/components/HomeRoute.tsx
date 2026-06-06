import { useAuth } from '../context/AuthContext'
import { isEmployeePortal } from '../config/navigation'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import { EmployeeHomePage } from '../pages/home/EmployeeHomePage'

export function HomeRoute() {
  const { user } = useAuth()
  return isEmployeePortal(user) ? <EmployeeHomePage /> : <DashboardPage />
}
