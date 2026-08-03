import { hashPassword } from './auth'
import { getDb, nullableInt } from './db'
import { unsafe } from './sql'
import { ValidationError } from './errors'
import { ensureBalancesForEmployee } from './leave'
import { createNotification } from './notifications'

import { isPlatformOwnerRoleSlug } from './role-slugs'

/** @deprecated Use ADMIN_ROLE_SLUG */
export const SYSTEM_ADMIN_ROLE_SLUG = 'admin'

const USER_SELECT = `
  SELECT u.id, u.email, u.is_active, u.account_status, u.employee_id, u.role_id,
         u.last_login_at, u.approved_at, u.activated_at, u.created_at,
         r.role_slug, r.role_name,
         e.emp_number, e.first_name, e.last_name, e.status AS employee_status,
         e.photo_url, e.gender, e.phone, e.is_stay_in, e.housing_deduction,
         e.date_of_birth, e.nationality, e.national_id, e.address,
         e.emergency_name, e.emergency_phone, e.hire_date, e.employment_type,
         e.branch_id, e.department_id, e.position_id,
         p.title AS position_title
  FROM users u
  INNER JOIN roles r ON r.role_id = u.role_id
  LEFT JOIN employees e ON e.id = u.employee_id
  LEFT JOIN positions p ON p.id = e.position_id
`

/** Staff logins managed from Admin → Users (excludes platform owner accounts). */
const MANAGEABLE_USERS_WHERE = `WHERE r.role_slug NOT IN ('admin', 'super_admin')`

function assertManageableUser(user: { role_slug?: string }) {
  if (isPlatformOwnerRoleSlug(user.role_slug)) {
    throw new Error('Platform owner account cannot be changed from user management')
  }
}

export async function listUsers(accountStatus?: string | null) {
  if (accountStatus) {
    return unsafe(
      `${USER_SELECT} ${MANAGEABLE_USERS_WHERE} AND u.account_status = $1 ORDER BY u.email`,
      [accountStatus],
    )
  }
  return unsafe(`${USER_SELECT} ${MANAGEABLE_USERS_WHERE} ORDER BY u.email`)
}

export async function listPendingRegistrations() {
  return unsafe(
    `${USER_SELECT} WHERE u.account_status IN ('awaiting_hr', 'pending') ORDER BY u.created_at ASC`,
  )
}

export async function getUser(id: string) {
  const rows = await unsafe(`${USER_SELECT} WHERE u.id = $1 LIMIT 1`, [id])
  if (!rows[0]) throw new Error('User not found')
  return rows[0]
}

export async function createUser(data: Record<string, unknown>) {
  const email = String(data.email ?? '').trim()
  const password = String(data.password ?? '')
  const roleId = Number(data.role_id)
  if (!email || !password || roleId < 1) {
    throw new ValidationError('email, password, and role_id required')
  }

  const db = getDb()
  const [role] = await db`SELECT role_slug FROM roles WHERE role_id = ${roleId} LIMIT 1`
  if (isPlatformOwnerRoleSlug(role?.role_slug)) {
    throw new ValidationError('Platform owner accounts cannot be created here')
  }

  const existing = await db`SELECT id FROM users WHERE email = ${email} LIMIT 1`
  if (existing[0]) throw new Error('Email already registered')

  let accountStatus = String(data.account_status ?? 'active')
  if (!['awaiting_hr', 'pending', 'active', 'rejected'].includes(accountStatus)) {
    accountStatus = 'active'
  }

  const isActive = accountStatus === 'active' || accountStatus === 'pending'
  const activatedAt = accountStatus === 'active' ? new Date().toISOString() : null

  const [row] = await db`
    INSERT INTO users (email, password_hash, role_id, employee_id, is_active, account_status, activated_at)
    VALUES (
      ${email}, ${hashPassword(password)}, ${roleId},
      ${nullableInt(data.employee_id)}, ${isActive}, ${accountStatus}, ${activatedAt}
    )
    RETURNING id
  `
  return getUser(String(row.id))
}

export async function updateUser(id: string, data: Record<string, unknown>) {
  const target = await getUser(id)
  assertManageableUser(target)

  const db = getDb()
  if (data.role_id != null) {
    const [role] = await db`SELECT role_slug FROM roles WHERE role_id = ${Number(data.role_id)} LIMIT 1`
    if (isPlatformOwnerRoleSlug(role?.role_slug)) {
      throw new ValidationError('Cannot assign platform owner roles from user management')
    }
  }
  if (data.email != null) {
    const email = String(data.email).trim().toLowerCase()
    if (!email) throw new ValidationError('email is required')
    const existing = await db`SELECT id FROM users WHERE email = ${email} AND id <> ${id} LIMIT 1`
    if (existing[0]) throw new Error('Email already registered')
    await db`UPDATE users SET email = ${email} WHERE id = ${id}`
    const linked = await db`SELECT employee_id FROM users WHERE id = ${id} LIMIT 1`
    const employeeId = linked[0]?.employee_id
    if (employeeId) {
      await db`UPDATE employees SET email = ${email} WHERE id = ${employeeId}`
    }
  }
  if (data.password) {
    await db`UPDATE users SET password_hash = ${hashPassword(String(data.password))} WHERE id = ${id}`
  }
  if (data.role_id != null) {
    await db`UPDATE users SET role_id = ${Number(data.role_id)} WHERE id = ${id}`
  }
  if ('employee_id' in data) {
    await db`UPDATE users SET employee_id = ${nullableInt(data.employee_id)} WHERE id = ${id}`
  }
  if (data.is_active != null) {
    await db`UPDATE users SET is_active = ${Boolean(data.is_active)} WHERE id = ${id}`
  }
  if (data.account_status != null) {
    const st = String(data.account_status)
    if (['awaiting_hr', 'pending', 'active', 'rejected'].includes(st)) {
      await db`UPDATE users SET account_status = ${st} WHERE id = ${id}`
    }
  }
  return getUser(id)
}

export async function approveRegistration(userId: string, hrUserId: string) {
  const user = await getUser(userId)
  if (user.account_status !== 'awaiting_hr') {
    throw new Error('Only awaiting HR registrations can be approved')
  }
  if (user.role_slug !== 'employee') {
    throw new Error('Only employee registrations use this workflow')
  }

  const db = getDb()
  await db`
    UPDATE users SET account_status = 'pending', is_active = true,
      approved_at = NOW(), approved_by = ${hrUserId}
    WHERE id = ${userId}
  `

  await notifyApplicant(
    userId,
    String(user.email),
    'Registration approved — you can sign in',
    'HR has approved your Highway Grill registration. Sign in to your account. Your status is pending until HR activates you for time clock, schedules, and payroll.',
    'registration_approved',
  )
  return getUser(userId)
}

export async function activateEmployee(userId: string, hrUserId: string) {
  const user = await getUser(userId)
  if (!['pending', 'awaiting_hr'].includes(String(user.account_status))) {
    throw new Error('Only pending employees can be activated')
  }
  const employeeId = String(user.employee_id)
  if (!employeeId) throw new Error('User is not linked to an employee record')

  const db = getDb()
  await db.begin(async (tx) => {
    await tx`
      UPDATE users SET account_status = 'active', is_active = true,
        approved_at = COALESCE(approved_at, NOW()), approved_by = COALESCE(approved_by, ${hrUserId}),
        activated_at = NOW(), activated_by = ${hrUserId}
      WHERE id = ${userId}
    `
    await tx`
      UPDATE employees SET status = 'active' WHERE id = ${employeeId} AND status = 'pending'
    `
  })

  await ensureBalancesForEmployee(employeeId, new Date(Date.now() + 8 * 60 * 60 * 1000).getUTCFullYear())

  const name = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
  await notifyApplicant(
    userId,
    String(user.email),
    'Account activated — you can clock in',
    `Hi ${name}, your employee account is now active. You can time in/out, view your schedule, apply for leave, and access payroll.`,
    'registration_activated',
  )
  return getUser(userId)
}

export async function rejectRegistration(userId: string, hrUserId: string, reason?: string | null) {
  const user = await getUser(userId)
  if (!['awaiting_hr', 'pending'].includes(String(user.account_status))) {
    throw new Error('Only pending registrations can be rejected')
  }

  const db = getDb()
  await db`
    UPDATE users SET account_status = 'rejected', is_active = false, approved_by = ${hrUserId}
    WHERE id = ${userId}
  `
  if (user.employee_id) {
    await db`
      UPDATE employees SET status = 'terminated'
      WHERE id = ${String(user.employee_id)} AND status IN ('pending', 'active')
    `
  }

  const note = reason ? ` Reason: ${reason}` : ''
  await notifyApplicant(
    userId,
    String(user.email),
    'Registration not approved',
    `Your Highway Grill registration was not approved.${note}`,
    'registration_rejected',
  )
  return getUser(userId)
}

async function notifyApplicant(
  userId: string,
  _email: string,
  title: string,
  body: string,
  type: string,
) {
  await createNotification(userId, type, title, body, userId, '/')
  // Email deferred to Phase 5 (Resend/SMTP)
}
