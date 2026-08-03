import type { AuthUser } from '../types/roles'
import { isSuperAdminRoleSlug, isSystemAdminRoleSlug } from './role-slugs'

/** On-site crew who clock in at the branch (not admin/HR management). */
export function isFieldStaff(user: AuthUser | null): boolean {
  return user?.role_slug === 'employee'
}

/** System Admin — settings, compliance, staff logins (HG_web admin portal). */
export function isSystemAdmin(user: AuthUser | null): boolean {
  return isSystemAdminRoleSlug(user?.role_slug)
}

/** Super Admin — security monitoring (logs, threats, employee map). */
export function isSuperAdmin(user: AuthUser | null): boolean {
  return isSuperAdminRoleSlug(user?.role_slug)
}

/** Logins that appear in Admin → Staff logins (HR + employee accounts). */
export function isManageableStaffRole(roleSlug?: string | null): boolean {
  return roleSlug != null && !isSystemAdminRoleSlug(roleSlug) && !isSuperAdminRoleSlug(roleSlug)
}
