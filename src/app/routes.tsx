import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { RequirePermission } from '../components/RequirePermission'
import { HomeRoute } from '../components/HomeRoute'
import { PayrollRoute } from '../components/PayrollRoute'
import { AuthLayout } from '../layouts/AuthLayout'
import { DashboardLayout } from '../layouts/DashboardLayout'
import { LoginPage } from '../pages/auth/LoginPage'
import { RegisterPage } from '../pages/auth/RegisterPage'
import { RequireActiveEmployee } from '../components/RequireActiveEmployee'
import { EmployeeListPage } from '../pages/employees/EmployeeListPage'
import { AttendancePage } from '../pages/attendance/AttendancePage'
import { LeavePage } from '../pages/leave/LeavePage'
import { UsersPage } from '../pages/users/UsersPage'
import { ShiftsPage } from '../pages/shifts/ShiftsPage'
import { SettingsPage } from '../pages/settings/SettingsPage'
import { CompliancePage } from '../pages/compliance/CompliancePage'
import { ProfilePage } from '../pages/profile/ProfilePage'
import { MyShiftsPage } from '../pages/shifts/MyShiftsPage'
import { MenuPage } from '../pages/menu/MenuPage'
import { DtrPage } from '../pages/dtr/DtrPage'
import { MemosNoticesPage } from '../pages/memos/MemosNoticesPage'
import { LoansPage } from '../pages/employee/LoansPage'
import { BenefitsPage } from '../pages/employee/BenefitsPage'
import { ServiceRecordsPage } from '../pages/employee/ServiceRecordsPage'
import { MyDocumentsPage } from '../pages/documents/MyDocumentsPage'
import { HrLoansPage } from '../pages/hr/HrLoansPage'
import { HrContentPage } from '../pages/hr/HrContentPage'
import { AttendanceStatsPage } from '../pages/attendance/AttendanceStatsPage'
import { HrFieldWorkPage } from '../pages/hr/HrFieldWorkPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p className="loading-block" style={{ padding: '2rem' }}>Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomeRoute />} />
        <Route path="menu" element={<MenuPage />} />

        <Route
          path="dtr"
          element={
            <RequirePermission permission="attendance.self">
              <RequireActiveEmployee>
                <DtrPage />
              </RequireActiveEmployee>
            </RequirePermission>
          }
        />
        <Route path="overtime" element={<Navigate to="/dtr" replace />} />
        <Route
          path="leaves"
          element={
            <RequirePermission permission={['leave.view', 'leave.apply']}>
              <RequireActiveEmployee>
                <LeavePage />
              </RequireActiveEmployee>
            </RequirePermission>
          }
        />
        <Route path="payroll" element={<PayrollRoute />} />
        <Route
          path="scheduling"
          element={
            <RequirePermission permission="shifts.view.self">
              <RequireActiveEmployee>
                <MyShiftsPage />
              </RequireActiveEmployee>
            </RequirePermission>
          }
        />
        <Route
          path="documents"
          element={
            <RequirePermission permission="documents.view.self">
              <RequireActiveEmployee>
                <MyDocumentsPage />
              </RequireActiveEmployee>
            </RequirePermission>
          }
        />
        <Route
          path="memos"
          element={
            <RequirePermission permission="announcements.view">
              <MemosNoticesPage />
            </RequirePermission>
          }
        />
        <Route
          path="loans"
          element={
            <RequirePermission permission="loans.self">
              <RequireActiveEmployee>
                <LoansPage />
              </RequireActiveEmployee>
            </RequirePermission>
          }
        />
        <Route
          path="benefits"
          element={
            <RequirePermission permission="payroll.view.self">
              <RequireActiveEmployee>
                <BenefitsPage />
              </RequireActiveEmployee>
            </RequirePermission>
          }
        />
        <Route
          path="service-records"
          element={
            <RequirePermission permission="documents.view.self">
              <RequireActiveEmployee>
                <ServiceRecordsPage />
              </RequireActiveEmployee>
            </RequirePermission>
          }
        />
        <Route path="field-work" element={<Navigate to="/" replace />} />
        <Route path="profile" element={<ProfilePage />} />

        <Route path="leave" element={<Navigate to="/leaves" replace />} />
        <Route path="my-shifts" element={<Navigate to="/scheduling" replace />} />
        <Route path="my-payslips" element={<Navigate to="/payroll" replace />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route
          path="hr/attendance-stats"
          element={
            <RequirePermission permission="attendance.view">
              <AttendanceStatsPage />
            </RequirePermission>
          }
        />
        <Route path="hr/overtime" element={<Navigate to="/hr/attendance-stats" replace />} />
        <Route
          path="hr/field-work"
          element={
            <RequirePermission permission="attendance.view">
              <HrFieldWorkPage />
            </RequirePermission>
          }
        />
        <Route
          path="hr/loans"
          element={
            <RequirePermission permission="loans.manage">
              <HrLoansPage />
            </RequirePermission>
          }
        />
        <Route
          path="hr/content"
          element={
            <RequirePermission permission="employees.manage">
              <HrContentPage />
            </RequirePermission>
          }
        />

        <Route
          path="employees"
          element={
            <RequirePermission permission="employees.view">
              <EmployeeListPage />
            </RequirePermission>
          }
        />
        <Route
          path="users"
          element={
            <RequirePermission permission="users.manage">
              <UsersPage />
            </RequirePermission>
          }
        />
        <Route
          path="shifts"
          element={
            <RequirePermission permission="shifts.manage">
              <ShiftsPage />
            </RequirePermission>
          }
        />
        <Route
          path="settings"
          element={
            <RequirePermission permission={['settings.branches.manage', 'settings.departments.manage']}>
              <SettingsPage />
            </RequirePermission>
          }
        />
        <Route
          path="compliance"
          element={
            <RequirePermission permission="compliance.view">
              <CompliancePage />
            </RequirePermission>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
