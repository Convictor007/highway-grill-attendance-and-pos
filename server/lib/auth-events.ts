import { getDb } from './db'
import { loginAttemptCount } from './rate-limit'

export type AuthEventType =
  | 'login_success'
  | 'login_failed'
  | 'login_rate_limited'
  | 'logout'
  | 'register_submitted'
  | 'register_approved'
  | 'register_rejected'
  | 'register_activated'

export type ThreatLevel = 'none' | 'low' | 'medium' | 'high'

export type LogAuthEventInput = {
  eventType: AuthEventType
  userId?: string | number | null
  email?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  meta?: Record<string, unknown> | null
  threatLevel?: ThreatLevel
}

export async function logAuthEvent(input: LogAuthEventInput): Promise<void> {
  const db = getDb()
  const threat =
    input.threatLevel ??
    (input.eventType === 'login_rate_limited'
      ? 'high'
      : input.eventType === 'login_failed' && loginAttemptCount(input.ipAddress ?? null) >= 8
        ? 'medium'
        : 'none')

  try {
    await db`
      INSERT INTO auth_events (event_type, user_id, email, ip_address, user_agent, meta, threat_level)
      VALUES (
        ${input.eventType},
        ${input.userId != null ? Number(input.userId) : null},
        ${input.email?.trim().toLowerCase() || null},
        ${input.ipAddress?.slice(0, 45) || null},
        ${input.userAgent?.slice(0, 500) || null},
        ${input.meta ? JSON.stringify(input.meta) : null},
        ${threat}
      )
    `
  } catch {
    // Table may not exist until patch is applied — do not block auth flow.
  }
}

export type AuthEventRow = {
  id: string
  event_type: string
  user_id: string | null
  email: string | null
  ip_address: string | null
  user_agent: string | null
  meta: Record<string, unknown> | null
  threat_level: string
  created_at: string
  role_slug?: string | null
  role_name?: string | null
}

export async function listAuthEvents(opts: {
  limit?: number
  eventType?: string | null
  ip?: string | null
}): Promise<AuthEventRow[]> {
  const db = getDb()
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500)
  const eventType = opts.eventType?.trim() || null
  const ip = opts.ip?.trim() || null

  const rows = await db<AuthEventRow[]>`
    SELECT ae.id::text, ae.event_type, ae.user_id::text, ae.email, ae.ip_address, ae.user_agent,
           ae.meta, ae.threat_level, ae.created_at::text,
           r.role_slug, r.role_name
    FROM auth_events ae
    LEFT JOIN users u ON u.id = ae.user_id
    LEFT JOIN roles r ON r.role_id = u.role_id
    WHERE (${eventType}::text IS NULL OR ae.event_type = ${eventType})
      AND (${ip}::text IS NULL OR ae.ip_address = ${ip})
    ORDER BY ae.created_at DESC
    LIMIT ${limit}
  `
  return rows
}

export async function listRegistrationEvents(limit = 100): Promise<AuthEventRow[]> {
  const db = getDb()
  const cap = Math.min(Math.max(limit, 1), 500)
  const rows = await db<AuthEventRow[]>`
    SELECT ae.id::text, ae.event_type, ae.user_id::text, ae.email, ae.ip_address, ae.user_agent,
           ae.meta, ae.threat_level, ae.created_at::text,
           r.role_slug, r.role_name
    FROM auth_events ae
    LEFT JOIN users u ON u.id = ae.user_id
    LEFT JOIN roles r ON r.role_id = u.role_id
    WHERE ae.event_type IN (
      'register_submitted', 'register_approved', 'register_rejected', 'register_activated'
    )
    ORDER BY ae.created_at DESC
    LIMIT ${cap}
  `
  return rows
}

export type ThreatRow = {
  ip_address: string
  failed_logins: number
  rate_limited: number
  last_seen: string
  threat_level: ThreatLevel
  sample_email: string | null
}

export async function listThreats(windowMinutes = 60): Promise<ThreatRow[]> {
  const db = getDb()
  const rows = await db<{
    ip_address: string
    failed_logins: number
    rate_limited: number
    last_seen: string
    sample_email: string | null
  }[]>`
    SELECT
      ae.ip_address,
      COUNT(*) FILTER (WHERE ae.event_type = 'login_failed')::int AS failed_logins,
      COUNT(*) FILTER (WHERE ae.event_type = 'login_rate_limited')::int AS rate_limited,
      MAX(ae.created_at)::text AS last_seen,
      (ARRAY_AGG(ae.email ORDER BY ae.created_at DESC))[1] AS sample_email
    FROM auth_events ae
    WHERE ae.ip_address IS NOT NULL
      AND ae.created_at > NOW() - (${windowMinutes}::int || ' minutes')::interval
      AND ae.event_type IN ('login_failed', 'login_rate_limited')
    GROUP BY ae.ip_address
    HAVING COUNT(*) FILTER (WHERE ae.event_type IN ('login_failed', 'login_rate_limited')) >= 3
    ORDER BY failed_logins DESC, rate_limited DESC
    LIMIT 50
  `

  return rows.map((row) => {
    let threat_level: ThreatLevel = 'low'
    if (row.rate_limited > 0 || row.failed_logins >= 15) threat_level = 'high'
    else if (row.failed_logins >= 8) threat_level = 'medium'
    return { ...row, threat_level }
  })
}

export type SecurityOverview = {
  logins_24h: number
  failed_logins_24h: number
  registrations_7d: number
  active_threats: number
  online_sessions: number
}

export async function securityOverview(): Promise<SecurityOverview> {
  const db = getDb()
  const [stats] = await db<{
    logins_24h: number
    failed_logins_24h: number
    registrations_7d: number
    online_sessions: number
  }[]>`
    SELECT
      COUNT(*) FILTER (WHERE event_type = 'login_success' AND created_at > NOW() - INTERVAL '24 hours')::int AS logins_24h,
      COUNT(*) FILTER (WHERE event_type = 'login_failed' AND created_at > NOW() - INTERVAL '24 hours')::int AS failed_logins_24h,
      COUNT(*) FILTER (WHERE event_type = 'register_submitted' AND created_at > NOW() - INTERVAL '7 days')::int AS registrations_7d,
      (SELECT COUNT(*)::int FROM user_sessions WHERE expires_at > NOW()) AS online_sessions
    FROM auth_events
  `

  const threats = await listThreats(60)
  return {
    logins_24h: stats?.logins_24h ?? 0,
    failed_logins_24h: stats?.failed_logins_24h ?? 0,
    registrations_7d: stats?.registrations_7d ?? 0,
    active_threats: threats.length,
    online_sessions: stats?.online_sessions ?? 0,
  }
}

export type EmployeeLocationRow = {
  employee_id: string
  emp_number: string
  first_name: string
  last_name: string
  branch_name: string | null
  latitude: number
  longitude: number
  clock_in: string
  clock_in_address: string | null
  is_clocked_in: boolean
}

/** Last known GPS from open or most recent attendance session per employee. */
export async function employeeLocations(): Promise<EmployeeLocationRow[]> {
  const db = getDb()
  const rows = await db<EmployeeLocationRow[]>`
    SELECT DISTINCT ON (a.employee_id)
      a.employee_id::text,
      e.emp_number,
      e.first_name,
      e.last_name,
      b.name AS branch_name,
      a.latitude::float8 AS latitude,
      a.longitude::float8 AS longitude,
      a.clock_in::text,
      a.clock_in_address,
      (a.clock_out IS NULL) AS is_clocked_in
    FROM attendance a
    INNER JOIN employees e ON e.id = a.employee_id
    LEFT JOIN branches b ON b.id = e.branch_id
    WHERE a.latitude IS NOT NULL AND a.longitude IS NOT NULL
      AND e.status IN ('active', 'pending')
    ORDER BY a.employee_id, (a.clock_out IS NULL) DESC, a.clock_in DESC
  `
  return rows.filter((r) => r.latitude != null && r.longitude != null)
}
