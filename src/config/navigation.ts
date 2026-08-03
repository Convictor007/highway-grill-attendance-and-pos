import type { AuthUser } from '../types/roles'
import { hasPermission } from '../lib/auth'
import { canUseEmployeeFeatures } from '../lib/accountStatus'
import { isSuperAdmin, isSystemAdmin } from '../lib/roles'

export type NavItem = {
  to: string
  label: string
  description?: string
  icon: string
  end?: boolean
  perm?: string | string[]
}

export type NavGroup = {
  type: 'group'
  id: string
  label: string
  icon: string
  items: NavItem[]
}

export type NavEntry = NavItem | NavGroup

export type NavSection = {
  label?: string
  items: NavEntry[]
}

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'type' in entry && entry.type === 'group'
}

/** Employee self-service menu (Profile last in full menu) */
export const employeeMenuItems: NavItem[] = [
  { to: '/dtr', label: 'DTR', description: 'Daily time record — in, out, hours', icon: 'clock', perm: 'attendance.self' },
  { to: '/leaves', label: 'Leaves', description: 'Apply and track leave', icon: 'calendar', perm: ['leave.view', 'leave.apply'] },
  { to: '/payroll', label: 'My Payroll', description: 'Payslips and pay history', icon: 'wallet', perm: 'payroll.view.self' },
  { to: '/scheduling', label: 'Scheduling', description: 'Weekly roster — who works each day', icon: 'schedule', perm: 'shifts.view.self' },
  { to: '/loans', label: 'Loans', description: 'Salary loans & advances', icon: 'loan', perm: 'loans.self' },
  { to: '/service-records', label: 'Service Records', description: 'Contracts & certificates', icon: 'folder', perm: 'documents.view.self' },
  { to: '/memos', label: 'Memos & Notices', description: 'Announcements from HR', icon: 'memo', perm: 'announcements.view' },
  { to: '/profile', label: 'Profile', description: 'Your info & settings', icon: 'user' },
]

/** HR daily operations — no system admin (settings / compliance) */
export const hrMenuEntries: NavEntry[] = [
  { to: '/', label: 'HR Dashboard', icon: 'home', end: true },
  {
    type: 'group',
    id: 'people',
    label: 'Employees',
    icon: 'users',
    items: [
      { to: '/employees', label: 'Employee list', icon: 'users', perm: 'employees.view' },
      { to: '/users', label: 'Crew approvals', icon: 'key', perm: 'users.approve' },
    ],
  },
  { to: '/shifts', label: 'Shifts', icon: 'schedule', perm: 'shifts.manage' },
    {
    type: 'group',
    id: 'attendance',
    label: 'Attendance',
    icon: 'clock',
    items: [
      { to: '/attendance', label: 'Attendance register', icon: 'clock', perm: 'attendance.view' },
      { to: '/hr/attendance-corrections', label: 'Corrections', icon: 'memo', perm: 'attendance.correct.approve' },
      { to: '/hr/attendance-stats', label: 'Attendance stats', icon: 'overtime', perm: 'attendance.view' },
      { to: '/hr/dtr-export', label: 'Export DTR', icon: 'folder', perm: 'attendance.view' },
    ],
  },
  { to: '/hr/field-work', label: 'Field work', icon: 'map', perm: 'attendance.view' },
  { to: '/hr/loans', label: 'Loans', icon: 'loan', perm: 'loans.manage' },
  { to: '/hr/benefits', label: 'Benefits', icon: 'benefit', perm: 'payroll.manage' },
  { to: '/hr/tips', label: 'Tips pool', icon: 'wallet', perm: 'payroll.view' },
  { to: '/hr/content', label: 'HR content', icon: 'memo', perm: 'employees.manage' },
  { to: '/hr/reports', label: 'Reports', icon: 'overtime', perm: 'reports.view' },
  { to: '/leaves', label: 'Leave', icon: 'calendar', perm: ['leave.view', 'leave.approve', 'leave.manage'] },
  { to: '/payroll', label: 'Payroll', icon: 'wallet', perm: 'payroll.view' },
]

/** System admin only — no HR daily operations */
export const adminSystemItems: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: 'home', end: true },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
  { to: '/admin/compliance', label: 'Compliance', icon: 'shield' },
  { to: '/admin/users', label: 'Staff logins', icon: 'key', perm: 'users.manage' },
]

/** Super Admin security portal */
export const securitySystemItems: NavItem[] = [
  { to: '/security', label: 'Overview', icon: 'shield', end: true, perm: 'security.view' },
  { to: '/security/auth-logs', label: 'Auth logs', icon: 'key', perm: 'security.view' },
  { to: '/security/registration-logs', label: 'Registration logs', icon: 'users', perm: 'security.view' },
  { to: '/security/threats', label: 'Threats', icon: 'memo', perm: 'security.view' },
  { to: '/security/map', label: 'Employee map', icon: 'map', perm: 'security.view' },
]

export function staffMenuSections(user: AuthUser | null): NavSection[] {
  if (isSuperAdmin(user)) {
    return [{ items: filterNav(securitySystemItems, user) }]
  }
  if (isSystemAdmin(user)) {
    return [{ items: filterNav(adminSystemItems, user) }]
  }
  return [{ items: filterNavEntries(hrMenuEntries, user) }]
}

function itemVisible(item: NavItem, user: AuthUser | null): boolean {
  if (user?.role_slug === 'employee' && item.perm && !canUseEmployeeFeatures(user)) {
    return item.to === '/profile'
  }
  if (!item.perm) return true
  const list = Array.isArray(item.perm) ? item.perm : [item.perm]
  return list.some((p) => hasPermission(user, p))
}

export function filterNav(items: NavItem[], user: AuthUser | null): NavItem[] {
  return items.filter((item) => itemVisible(item, user))
}

export function filterNavEntries(entries: NavEntry[], user: AuthUser | null): NavEntry[] {
  const out: NavEntry[] = []
  for (const entry of entries) {
    if (isNavGroup(entry)) {
      const items = entry.items.filter((item) => itemVisible(item, user))
      if (items.length > 0) out.push({ ...entry, items })
    } else if (itemVisible(entry, user)) {
      out.push(entry)
    }
  }
  return out
}
