import type { AuthUser } from '../types/roles'
import { hasPermission } from '../lib/auth'

export type NavItem = {
  to: string
  label: string
  description?: string
  icon: string
  end?: boolean
  perm?: string | string[]
}

/** Employee self-service menu (Profile last in full menu) */
export const employeeMenuItems: NavItem[] = [
  { to: '/dtr', label: 'DTR', description: 'Daily time record — in, out, hours', icon: 'clock', perm: 'attendance.self' },
  { to: '/leaves', label: 'Leaves', description: 'Apply and track leave', icon: 'calendar', perm: ['leave.view', 'leave.apply'] },
  { to: '/payroll', label: 'My Payroll', description: 'Payslips and pay history', icon: 'wallet', perm: 'payroll.view.self' },
  { to: '/scheduling', label: 'Scheduling', description: 'Weekly roster — who works each day', icon: 'schedule', perm: 'shifts.view.self' },
  { to: '/overtime', label: 'Overtime', description: 'Request extra hours', icon: 'overtime', perm: 'overtime.apply' },
  { to: '/loans', label: 'Loans', description: 'Salary loans & advances', icon: 'loan', perm: 'loans.self' },
  { to: '/benefits', label: 'Benefits', description: 'SSS, PhilHealth, Pag-IBIG', icon: 'benefit', perm: 'payroll.view.self' },
  { to: '/service-records', label: 'Service Records', description: 'Contracts & certificates', icon: 'folder', perm: 'documents.view.self' },
  { to: '/memos', label: 'Memos & Notices', description: 'Announcements from HR', icon: 'memo', perm: 'announcements.view' },
  { to: '/profile', label: 'Profile', description: 'Your info & settings', icon: 'user' },
]

export const adminMenuItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'home', end: true },
  { to: '/employees', label: 'Employees', icon: 'users', perm: 'employees.view' },
  { to: '/users', label: 'Users', icon: 'key', perm: 'users.manage' },
  { to: '/shifts', label: 'Shifts', icon: 'schedule', perm: 'shifts.manage' },
  { to: '/attendance', label: 'Attendance', icon: 'clock', perm: 'attendance.view' },
  { to: '/hr/attendance-stats', label: 'Attendance stats', icon: 'overtime', perm: 'attendance.view' },
  { to: '/hr/overtime', label: 'Overtime', icon: 'overtime', perm: 'attendance.manage' },
  { to: '/hr/loans', label: 'Loans', icon: 'loan', perm: 'loans.manage' },
  { to: '/hr/content', label: 'HR content', icon: 'memo', perm: 'employees.manage' },
  { to: '/leave', label: 'Leave', icon: 'calendar', perm: 'leave.view' },
  { to: '/payroll', label: 'Payroll', icon: 'wallet', perm: 'payroll.view' },
  { to: '/settings', label: 'Settings', icon: 'settings', perm: ['settings.branches.manage', 'settings.departments.manage'] },
  { to: '/compliance', label: 'Compliance', icon: 'shield', perm: 'compliance.view' },
]

export function filterNav(items: NavItem[], user: AuthUser | null): NavItem[] {
  return items.filter((item) => {
    if (!item.perm) return true
    const list = Array.isArray(item.perm) ? item.perm : [item.perm]
    return list.some((p) => hasPermission(user, p))
  })
}

export function isEmployeePortal(user: AuthUser | null): boolean {
  return user?.role_slug === 'employee'
}
