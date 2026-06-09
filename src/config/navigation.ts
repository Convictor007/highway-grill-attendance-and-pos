import type { AuthUser } from '../types/roles'
import { hasPermission } from '../lib/auth'
import { canUseEmployeeFeatures } from '../lib/accountStatus'
import { isSystemAdmin } from '../lib/roles'

export type NavItem = {
  to: string
  label: string
  description?: string
  icon: string
  end?: boolean
  perm?: string | string[]
}

export type NavSection = {
  label?: string
  items: NavItem[]
}

/** Employee self-service menu (Profile last in full menu) */
export const employeeMenuItems: NavItem[] = [
  { to: '/dtr', label: 'DTR', description: 'Daily time record — in, out, hours', icon: 'clock', perm: 'attendance.self' },
  { to: '/leaves', label: 'Leaves', description: 'Apply and track leave', icon: 'calendar', perm: ['leave.view', 'leave.apply'] },
  { to: '/payroll', label: 'My Payroll', description: 'Payslips and pay history', icon: 'wallet', perm: 'payroll.view.self' },
  { to: '/scheduling', label: 'Scheduling', description: 'Weekly roster — who works each day', icon: 'schedule', perm: 'shifts.view.self' },
  { to: '/loans', label: 'Loans', description: 'Salary loans & advances', icon: 'loan', perm: 'loans.self' },
  { to: '/benefits', label: 'Benefits', description: 'SSS, PhilHealth, Pag-IBIG', icon: 'benefit', perm: 'payroll.view.self' },
  { to: '/service-records', label: 'Service Records', description: 'Contracts & certificates', icon: 'folder', perm: 'documents.view.self' },
  { to: '/memos', label: 'Memos & Notices', description: 'Announcements from HR', icon: 'memo', perm: 'announcements.view' },
  { to: '/profile', label: 'Profile', description: 'Your info & settings', icon: 'user' },
]

/** HR daily operations — no system admin (settings / compliance) */
export const hrMenuItems: NavItem[] = [
  { to: '/', label: 'HR Dashboard', icon: 'home', end: true },
  { to: '/employees', label: 'Employees', icon: 'users', perm: 'employees.view' },
  { to: '/users', label: 'Crew approvals', icon: 'key', perm: 'users.approve' },
  { to: '/shifts', label: 'Shifts', icon: 'schedule', perm: 'shifts.manage' },
  { to: '/attendance', label: 'Attendance', icon: 'clock', perm: 'attendance.view' },
  { to: '/hr/attendance-stats', label: 'Attendance stats', icon: 'overtime', perm: 'attendance.view' },
  { to: '/hr/field-work', label: 'Field work', icon: 'map', perm: 'attendance.view' },
  { to: '/hr/loans', label: 'Loans', icon: 'loan', perm: 'loans.manage' },
  { to: '/hr/content', label: 'HR content', icon: 'memo', perm: 'employees.manage' },
  { to: '/leave', label: 'Leave', icon: 'calendar', perm: 'leave.view' },
  { to: '/payroll', label: 'Payroll', icon: 'wallet', perm: 'payroll.view' },
]

/** System admin only — no HR daily operations */
export const adminSystemItems: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: 'home', end: true },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
  { to: '/admin/compliance', label: 'Compliance', icon: 'shield' },
  { to: '/admin/users', label: 'Users', icon: 'key', perm: 'users.manage' },
]

export function staffMenuSections(user: AuthUser | null): NavSection[] {
  if (isSystemAdmin(user)) {
    return [{ items: filterNav(adminSystemItems, user) }]
  }
  return [{ items: filterNav(hrMenuItems, user) }]
}

export function filterNav(items: NavItem[], user: AuthUser | null): NavItem[] {
  return items.filter((item) => {
    if (user?.role_slug === 'employee' && item.perm && !canUseEmployeeFeatures(user)) {
      return item.to === '/profile'
    }
    if (!item.perm) return true
    const list = Array.isArray(item.perm) ? item.perm : [item.perm]
    return list.some((p) => hasPermission(user, p))
  })
}

export function isEmployeePortal(user: AuthUser | null): boolean {
  return user?.role_slug === 'employee'
}
