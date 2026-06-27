import type { AuthUser } from '../types/roles'

export type AccountStatus = 'awaiting_hr' | 'pending' | 'active' | 'rejected'

export function accountStatus(user: AuthUser | null): AccountStatus {
  return (user?.account_status as AccountStatus) ?? 'active'
}

export function isEmployeePortal(user: AuthUser | null): boolean {
  return user?.role_slug === 'employee'
}

/** HR approved — can sign in, notifications, profile; not yet on duty. */
export function isPendingEmployee(user: AuthUser | null): boolean {
  return isEmployeePortal(user) && accountStatus(user) === 'pending'
}

/** Fully activated — time clock, schedules, loans, payroll. */
export function isActiveEmployee(user: AuthUser | null): boolean {
  return isEmployeePortal(user) && accountStatus(user) === 'active'
}

export function canUseEmployeeFeatures(user: AuthUser | null): boolean {
  return isActiveEmployee(user)
}
