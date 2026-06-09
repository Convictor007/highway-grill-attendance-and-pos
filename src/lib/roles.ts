import type { AuthUser } from '../types/roles'

/** On-site crew who clock in at the branch (not admin/HR management). */
export function isFieldStaff(user: AuthUser | null): boolean {
  return user?.role_slug === 'employee'
}

export function isManagementRole(user: AuthUser | null): boolean {
  const slug = user?.role_slug ?? ''
  return slug === 'admin' || slug === 'hr'
}

/** System owner — settings, compliance, full RBAC. */
export function isSystemAdmin(user: AuthUser | null): boolean {
  return user?.role_slug === 'admin'
}
