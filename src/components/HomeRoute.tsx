import { useAuth } from '../context/AuthContext'
import { isEmployeePortal, isPendingEmployee } from '../lib/accountStatus'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import { EmployeeHomePage } from '../pages/home/EmployeeHomePage'
import { PendingEmployeeHomePage } from '../pages/home/PendingEmployeeHomePage'

export function HomeRoute() {
  const { user } = useAuth()
  if (isPendingEmployee(user)) return <PendingEmployeeHomePage />
  return isEmployeePortal(user) ? <EmployeeHomePage /> : <DashboardPage />
}
