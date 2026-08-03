import { getDb } from './db'
import type { AuthUser } from './auth'

export type LocationPingInput = {
  latitude: number
  longitude: number
  accuracy_m?: number | null
  altitude_m?: number | null
  speed_mps?: number | null
  heading_deg?: number | null
  source?: 'background' | 'foreground' | 'manual'
}

export async function recordLocationPing(user: AuthUser, input: LocationPingInput): Promise<void> {
  const lat = Number(input.latitude)
  const lng = Number(input.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('latitude and longitude are required')
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Invalid coordinates')
  }

  const db = getDb()
  const employeeId = user.employee_id ? Number(user.employee_id) : null
  const source = input.source ?? 'background'

  await db`
    INSERT INTO employee_location_pings (
      user_id, employee_id, latitude, longitude,
      accuracy_m, altitude_m, speed_mps, heading_deg, source
    ) VALUES (
      ${Number(user.id)}, ${employeeId}, ${lat}, ${lng},
      ${input.accuracy_m ?? null}, ${input.altitude_m ?? null},
      ${input.speed_mps ?? null}, ${input.heading_deg ?? null}, ${source}
    )
  `
}

export type LiveEmployeeLocation = {
  user_id: string
  employee_id: string | null
  emp_number: string | null
  first_name: string | null
  last_name: string | null
  email: string
  branch_name: string | null
  latitude: number
  longitude: number
  accuracy_m: number | null
  source: string
  recorded_at: string
  minutes_ago: number
  is_live: boolean
  is_clocked_in: boolean
}

const LIVE_THRESHOLD_MINUTES = 10

/** Latest GPS ping per user — live background tracking (not tied to attendance). */
export async function liveEmployeeLocations(): Promise<LiveEmployeeLocation[]> {
  const db = getDb()
  const rows = await db<LiveEmployeeLocation[]>`
    SELECT DISTINCT ON (p.user_id)
      p.user_id::text,
      p.employee_id::text,
      e.emp_number,
      e.first_name,
      e.last_name,
      u.email,
      b.name AS branch_name,
      p.latitude::float8 AS latitude,
      p.longitude::float8 AS longitude,
      p.accuracy_m::float8 AS accuracy_m,
      p.source,
      p.recorded_at::text,
      EXTRACT(EPOCH FROM (NOW() - p.recorded_at)) / 60.0 AS minutes_ago,
      (p.recorded_at > NOW() - (${LIVE_THRESHOLD_MINUTES}::int || ' minutes')::interval) AS is_live,
      EXISTS (
        SELECT 1 FROM attendance a
        WHERE a.employee_id = e.id AND a.clock_out IS NULL
      ) AS is_clocked_in
    FROM employee_location_pings p
    INNER JOIN users u ON u.id = p.user_id
    LEFT JOIN employees e ON e.id = p.employee_id
    LEFT JOIN branches b ON b.id = e.branch_id
    WHERE u.is_active = true
      AND u.account_status IN ('pending', 'active')
    ORDER BY p.user_id, p.recorded_at DESC
  `
  return rows.filter((r) => r.latitude != null && r.longitude != null)
}

export async function countRecentlyTrackedDevices(withinMinutes = 30): Promise<number> {
  const db = getDb()
  const [row] = await db<{ count: number }[]>`
    SELECT COUNT(DISTINCT user_id)::int AS count
    FROM employee_location_pings
    WHERE recorded_at > NOW() - (${withinMinutes}::int || ' minutes')::interval
  `
  return row?.count ?? 0
}
