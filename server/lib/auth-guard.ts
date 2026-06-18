import type { AuthUser } from './auth'
import { ForbiddenError } from './errors'
import { hasPermission } from './permissions'

export function requirePermission(user: AuthUser, key: string): void {
  if (!hasPermission(user, key)) throw new ForbiddenError()
}

/** Staff logins editor or HR employee records. */
export function requireEmployeeOrUserManage(user: AuthUser): void {
  if (!hasPermission(user, 'employees.manage') && !hasPermission(user, 'users.manage')) {
    throw new ForbiddenError()
  }
}

export function requireEmployeeViewOrUserManage(user: AuthUser): void {
  if (!hasPermission(user, 'employees.view') && !hasPermission(user, 'users.manage')) {
    throw new ForbiddenError()
  }
}

export function requireCrewApproval(user: AuthUser): void {
  if (!hasPermission(user, 'users.manage') && !hasPermission(user, 'users.approve')) {
    throw new ForbiddenError()
  }
}

export function requireActiveEmployeeAccount(user: AuthUser): void {
  if (user.role_slug !== 'employee') return
  if (user.account_status !== 'active') {
    throw new ForbiddenError(
      'Your account must be activated by HR before using time clock, schedules, and payroll features.',
    )
  }
  if (!user.employee_id) {
    throw new ForbiddenError('No employee record linked to your account.')
  }
}
