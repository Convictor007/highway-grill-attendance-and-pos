import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import bcrypt from 'bcryptjs'
import { getDb } from './db'
import { config } from './env'
import { permissionsForUser } from './permissions'

const BCRYPT_ROUNDS = 10

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized')
    this.name = 'UnauthorizedError'
  }
}

export type AuthUser = {
  id: string
  email: string
  role_id: number
  employee_id: string | null
  is_active: boolean
  account_status: string
  role_slug: string
  role_name: string
  role_type: string
  expires_at?: string
  permissions?: string[]
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function isBcryptHash(stored: string): boolean {
  return stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')
}

async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (config.authHashPasswords || isBcryptHash(stored)) {
    return bcrypt.compare(plain, stored)
  }
  const a = Buffer.from(stored)
  const b = Buffer.from(plain)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function hashPassword(plain: string): string {
  if (config.authHashPasswords) {
    return bcrypt.hashSync(plain, BCRYPT_ROUNDS)
  }
  return plain
}

export async function login(email: string, password: string) {
  const db = getDb()
  const rows = await db<AuthUser[]>`
    SELECT u.id, u.email, u.password_hash, u.role_id, u.employee_id, u.is_active, u.account_status,
           r.role_slug, r.role_name, r.role_type
    FROM users u
    INNER JOIN roles r ON r.role_id = u.role_id
    WHERE u.email = ${email.trim().toLowerCase()}
    LIMIT 1
  `
  const row = rows[0] as (AuthUser & { password_hash: string }) | undefined
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return null
  }

  const accountStatus = row.account_status ?? 'active'
  if (accountStatus === 'awaiting_hr') {
    throw new Error('Your registration is pending HR review. You will receive an email when you can sign in.')
  }
  if (accountStatus === 'rejected') {
    throw new Error('Your registration was not approved. Contact HR if you have questions.')
  }
  if (!row.is_active || !['pending', 'active'].includes(accountStatus)) {
    return null
  }

  const token = randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)
  const hours = config.sessionTtlHours
  const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString()

  await db`
    INSERT INTO user_sessions (user_id, token_hash, expires_at)
    VALUES (${row.id}, ${tokenHash}, ${expiresAt}::timestamptz)
  `
  await db`UPDATE users SET last_login_at = NOW() WHERE id = ${row.id}`

  const permissions = await permissionsForUser(row.role_id, row.id)
  const user: AuthUser = {
    id: row.id,
    email: row.email,
    role_id: row.role_id,
    employee_id: row.employee_id,
    is_active: row.is_active,
    account_status: row.account_status,
    role_slug: row.role_slug,
    role_name: row.role_name,
    role_type: row.role_type,
  }

  return {
    token,
    expires_at: expiresAt,
    user: { ...user, permissions },
    permissions,
  }
}

export async function userFromToken(token: string | null): Promise<AuthUser | null> {
  if (!token) return null
  const db = getDb()
  const tokenHash = hashToken(token)
  const rows = await db<AuthUser[]>`
    SELECT u.id, u.email, u.role_id, u.employee_id, u.is_active, u.account_status,
           r.role_slug, r.role_name, r.role_type, s.expires_at::text
    FROM user_sessions s
    INNER JOIN users u ON u.id = s.user_id
    INNER JOIN roles r ON r.role_id = u.role_id
    WHERE s.token_hash = ${tokenHash}
      AND s.expires_at > NOW()
      AND u.is_active = true
      AND u.account_status IN ('pending', 'active')
    LIMIT 1
  `
  const user = rows[0]
  if (!user) return null
  user.permissions = await permissionsForUser(user.role_id, user.id)
  return user
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')
  if (header?.startsWith('Bearer ')) {
    return header.slice(7).trim()
  }
  const url = new URL(request.url)
  const q = url.searchParams.get('token')
  return q?.trim() || null
}

export async function requireUser(request: Request): Promise<AuthUser> {
  const user = await userFromToken(bearerToken(request))
  if (!user) throw new UnauthorizedError()
  return user
}

export async function logout(token: string | null): Promise<void> {
  if (!token) return
  const db = getDb()
  await db`DELETE FROM user_sessions WHERE token_hash = ${hashToken(token)}`
}

export async function enrichUser(user: AuthUser): Promise<AuthUser & { employee?: Record<string, unknown> | null }> {
  if (!user.employee_id) {
    return { ...user, employee: null }
  }
  const db = getDb()
  const rows = await db<Record<string, unknown>[]>`
    SELECT id, emp_number, first_name, last_name, branch_id, department_id, position_id, status,
           photo_url, gender, date_of_birth
    FROM employees WHERE id = ${user.employee_id}
    LIMIT 1
  `
  return { ...user, employee: rows[0] ?? null }
}
