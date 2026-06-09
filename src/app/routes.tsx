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
import { EmployeeListPage } from '../pages/employees/EmployeeListPage'
import { AttendancePage } from '../pages/attendance/AttendancePage'
import { LeavePage } from '../pages/leave/LeavePage'
import { UsersPage } from '../pages/users/UsersPage'
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage'
import { RequireAdmin } from '../components/RequireAdmin'
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
import { BenefitsPage } from '../pages/employee/BenefitsPage'
import { ServiceRecordsPage } from '../pages/employee/ServiceRecordsPage'
import { MyDocumentsPage } from '../pages/documents/MyDocumentsPage'
import { HrLoansPage } from '../pages/hr/HrLoansPage'
import { HrContentPage } from '../pages/hr/HrContentPage'
import { AttendanceStatsPage } from '../pages/attendance/AttendanceStatsPage'
import { HrFieldWorkPage } from '../pages/hr/HrFieldWorkPage'
import { HrTipsPage } from '../pages/hr/HrTipsPage'
import { HrReportsPage } from '../pages/hr/HrReportsPage'

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
        <Route path="hr/overtime" element={<Navigate to="/hr/attendance-stats" replace />} />
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
        <Route path="admin/field-work" element={<Navigate to="/admin" replace />} />
        <Route path="settings" element={<Navigate to="/admin/settings" replace />} />
        <Route path="compliance" element={<Navigate to="/admin/compliance" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
