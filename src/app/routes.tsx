import { Navigate, Route, Routes } from 'react-router-dom'
import { LoadingBlock } from '../components/LoadingBlock'
import { useAuth } from '../context/AuthContext'
import { RequirePermission } from '../components/RequirePermission'
import { HomeRoute } from '../components/HomeRoute'
import { PayrollRoute } from '../components/PayrollRoute'
import { AuthLayout } from '../layouts/AuthLayout'
import { DashboardLayout } from '../layouts/DashboardLayout'
import { LoginPage } from '../pages/auth/LoginPage'
import { RegisterPage } from '../pages/auth/RegisterPage'
import { RequireActiveEmployee } from '../components/RequireActiveEmployee'
import { RequireLeaveAccess } from '../components/RequireLeaveAccess'
import { EmployeeListPage } from '../pages/employees/EmployeeListPage'
import { AttendancePage } from '../pages/attendance/AttendancePage'
import { LeavePage } from '../pages/leave/LeavePage'
import { UsersPage } from '../pages/users/UsersPage'
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage'
import { SecurityDashboardPage } from '../pages/security/SecurityDashboardPage'
import { SecurityAuthLogsPage } from '../pages/security/SecurityAuthLogsPage'
import { SecurityRegistrationLogsPage } from '../pages/security/SecurityRegistrationLogsPage'
import { SecurityThreatsPage } from '../pages/security/SecurityThreatsPage'
import { SecurityEmployeeMapPage } from '../pages/security/SecurityEmployeeMapPage'
import { RequireAdmin } from '../components/RequireAdmin'
import { RequireSecurity } from '../components/RequireSecurity'
import { RequireHr } from '../components/RequireHr'
import { ShiftsPage } from '../pages/shifts/ShiftsPage'
import { SettingsPage } from '../pages/settings/SettingsPage'
import { CompliancePage } from '../pages/compliance/CompliancePage'
import { ProfilePage } from '../pages/profile/ProfilePage'
import { MyShiftsPage } from '../pages/shifts/MyShiftsPage'
import { MenuPage } from '../pages/menu/MenuPage'
import { DtrPage } from '../pages/dtr/DtrPage'
import { MemosNoticesPage } from '../pages/memos/MemosNoticesPage'
import { LoansPage } from '../pages/employee/LoansPage'
import { ServiceRecordsPage } from '../pages/employee/ServiceRecordsPage'
import { HrLoansPage } from '../pages/hr/HrLoansPage'
import { HrContentPage } from '../pages/hr/HrContentPage'
import { AttendanceStatsPage } from '../pages/attendance/AttendanceStatsPage'
import { HrAttendanceCorrectionsPage } from '../pages/hr/HrAttendanceCorrectionsPage'
import { HrFieldWorkPage } from '../pages/hr/HrFieldWorkPage'
import { HrTipsPage } from '../pages/hr/HrTipsPage'
import { HrReportsPage } from '../pages/hr/HrReportsPage'
import { HrBenefitsPage } from '../pages/hr/HrBenefitsPage'
import { DtrExportPage } from '../pages/attendance/DtrExportPage'
import { LEGACY_REDIRECTS } from './legacyRedirects'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingBlock className="loading-block--page" />
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
        <Route
          path="leaves"
          element={
            <RequireLeaveAccess>
              <LeavePage />
            </RequireLeaveAccess>
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
          path="service-records"
          element={
            <RequirePermission permission="documents.view.self">
              <RequireActiveEmployee>
                <ServiceRecordsPage />
              </RequireActiveEmployee>
            </RequirePermission>
          }
        />
        <Route path="profile" element={<ProfilePage />} />

        <Route
          path="attendance"
          element={
            <RequireHr>
              <RequirePermission permission="attendance.view">
                <AttendancePage />
              </RequirePermission>
            </RequireHr>
          }
        />
        <Route
          path="hr/attendance-stats"
          element={
            <RequireHr>
              <RequirePermission permission="attendance.view">
                <AttendanceStatsPage />
              </RequirePermission>
            </RequireHr>
          }
        />
        <Route
          path="hr/attendance-corrections"
          element={
            <RequireHr>
              <RequirePermission permission="attendance.correct.approve">
                <HrAttendanceCorrectionsPage />
              </RequirePermission>
            </RequireHr>
          }
        />
        <Route
          path="hr/dtr-export"
          element={
            <RequireHr>
              <RequirePermission permission="attendance.view">
                <DtrExportPage />
              </RequirePermission>
            </RequireHr>
          }
        />
        <Route
          path="hr/field-work"
          element={
            <RequireHr>
              <RequirePermission permission="attendance.view">
                <HrFieldWorkPage />
              </RequirePermission>
            </RequireHr>
          }
        />
        <Route
          path="hr/loans"
          element={
            <RequireHr>
              <RequirePermission permission="loans.manage">
                <HrLoansPage />
              </RequirePermission>
            </RequireHr>
          }
        />
        <Route
          path="hr/benefits"
          element={
            <RequireHr>
              <RequirePermission permission="payroll.manage">
                <HrBenefitsPage />
              </RequirePermission>
            </RequireHr>
          }
        />
        <Route
          path="hr/content"
          element={
            <RequireHr>
              <RequirePermission permission="employees.manage">
                <HrContentPage />
              </RequirePermission>
            </RequireHr>
          }
        />
        <Route
          path="hr/tips"
          element={
            <RequireHr>
              <RequirePermission permission="payroll.view">
                <HrTipsPage />
              </RequirePermission>
            </RequireHr>
          }
        />
        <Route
          path="hr/reports"
          element={
            <RequireHr>
              <RequirePermission permission="reports.view">
                <HrReportsPage />
              </RequirePermission>
            </RequireHr>
          }
        />

        <Route
          path="employees"
          element={
            <RequireHr>
              <RequirePermission permission="employees.view">
                <EmployeeListPage />
              </RequirePermission>
            </RequireHr>
          }
        />
        <Route
          path="users"
          element={
            <RequireHr>
              <RequirePermission permission="users.approve">
                <UsersPage />
              </RequirePermission>
            </RequireHr>
          }
        />
        <Route
          path="shifts"
          element={
            <RequireHr>
              <RequirePermission permission="shifts.manage">
                <ShiftsPage />
              </RequirePermission>
            </RequireHr>
          }
        />
        <Route
          path="security"
          element={
            <RequireSecurity>
              <SecurityDashboardPage />
            </RequireSecurity>
          }
        />
        <Route
          path="security/auth-logs"
          element={
            <RequireSecurity>
              <SecurityAuthLogsPage />
            </RequireSecurity>
          }
        />
        <Route
          path="security/registration-logs"
          element={
            <RequireSecurity>
              <SecurityRegistrationLogsPage />
            </RequireSecurity>
          }
        />
        <Route
          path="security/threats"
          element={
            <RequireSecurity>
              <SecurityThreatsPage />
            </RequireSecurity>
          }
        />
        <Route
          path="security/map"
          element={
            <RequireSecurity>
              <SecurityEmployeeMapPage />
            </RequireSecurity>
          }
        />
        <Route
          path="admin"
          element={
            <RequireAdmin>
              <AdminDashboardPage />
            </RequireAdmin>
          }
        />
        <Route
          path="admin/settings"
          element={
            <RequireAdmin>
              <SettingsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="admin/compliance"
          element={
            <RequireAdmin>
              <CompliancePage />
            </RequireAdmin>
          }
        />
        <Route
          path="admin/users"
          element={
            <RequireAdmin>
              <RequirePermission permission="users.manage">
                <UsersPage fullAdmin />
              </RequirePermission>
            </RequireAdmin>
          }
        />
        {LEGACY_REDIRECTS.map(({ path, to }) => (
          <Route key={path} path={path} element={<Navigate to={to} replace />} />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
