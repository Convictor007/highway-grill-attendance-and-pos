import { getDb } from './db'
import { assertCoords, distanceMeters } from './geo'
import { ValidationError } from './errors'
import { unsafe, type SqlValue } from './sql'

const GPS_BUFFER_M = 30
const GPS_BUFFER_MAX_M = 60

export async function listSites(branchId?: string | null) {
  const db = getDb()
  if (branchId) {
    return db`
      SELECT id, branch_id, name, address, latitude, longitude, radius_m, is_active, clock_in_eligible
      FROM field_work_sites WHERE is_active = true AND (branch_id = ${branchId} OR branch_id IS NULL)
      ORDER BY name
    `
  }
  return db`SELECT id, branch_id, name, address, latitude, longitude, radius_m, is_active, clock_in_eligible
            FROM field_work_sites WHERE is_active = true ORDER BY name`
}

export async function listClockInSites(branchId?: string | null) {
  if (!branchId) return []
  const db = getDb()
  return db`
    SELECT id, branch_id, name, address, latitude, longitude, radius_m, is_active, clock_in_eligible
    FROM field_work_sites
    WHERE is_active = true AND clock_in_eligible = true AND branch_id = ${branchId}
    ORDER BY name
  `
}

export async function branchHasClockInZones(branchId?: string | null): Promise<boolean> {
  const sites = await listClockInSites(branchId)
  return sites.length > 0
}

export async function getSite(id: string) {
  const db = getDb()
  const rows = await db`
    SELECT id, branch_id, name, address, latitude, longitude, radius_m, is_active, clock_in_eligible, created_at
    FROM field_work_sites WHERE id = ${id} LIMIT 1
  `
  return rows[0] ?? null
}

function gpsBuffer(accuracyM?: number | null): number {
  if (accuracyM && accuracyM > 0) {
    return Math.min(GPS_BUFFER_MAX_M, Math.max(GPS_BUFFER_M, Math.round(accuracyM * 0.5)))
  }
  return GPS_BUFFER_M
}

function matchInList(
  lat: number,
  lng: number,
  sites: Record<string, unknown>[],
  buffer = 0,
): Record<string, unknown> | null {
  let best: Record<string, unknown> | null = null
  let bestDist = Infinity
  for (const site of sites) {
    const dist = distanceMeters(lat, lng, Number(site.latitude), Number(site.longitude))
    const radius = Number(site.radius_m ?? 150)
    if (dist <= radius + buffer && dist < bestDist) {
      bestDist = dist
      best = site
    }
  }
  return best
}

function nearestInList(lat: number, lng: number, sites: Record<string, unknown>[]) {
  let best: Record<string, unknown> | null = null
  let bestDist = Infinity
  for (const site of sites) {
    const dist = distanceMeters(lat, lng, Number(site.latitude), Number(site.longitude))
    if (dist < bestDist) {
      bestDist = dist
      best = site
    }
  }
  return best ? { site: best, distance_m: Math.round(bestDist * 10) / 10 } : null
}

export function matchClockInSite(
  lat: number,
  lng: number,
  branchId?: string | null,
  accuracyM?: number | null,
) {
  return listClockInSites(branchId).then((sites) => matchInList(lat, lng, sites, gpsBuffer(accuracyM)))
}

export async function zoneStatus(
  lat: number,
  lng: number,
  branchId?: string | null,
  clockInOnly = false,
  accuracyM?: number | null,
) {
  assertCoords(lat, lng)
  const buffer = gpsBuffer(accuracyM)
  const sites = clockInOnly ? await listClockInSites(branchId) : await listSites(branchId)
  const match = matchInList(lat, lng, sites, buffer)
  const nearest = nearestInList(lat, lng, sites)
  if (match) {
    const dist = distanceMeters(lat, lng, Number(match.latitude), Number(match.longitude))
    return {
      inside: true,
      site: { ...match, effective_radius_m: Number(match.radius_m ?? 150) + buffer, gps_buffer_m: buffer },
      distance_m: Math.round(dist * 10) / 10,
      nearest_site: nearest?.site ?? null,
      nearest_distance_m: nearest?.distance_m ?? null,
      gps_buffer_m: buffer,
    }
  }
  return {
    inside: false,
    site: null,
    distance_m: null,
    nearest_site: nearest?.site ?? null,
    nearest_distance_m: nearest?.distance_m ?? null,
    gps_buffer_m: buffer,
  }
}

export async function createSite(data: Record<string, unknown>) {
  const name = String(data.name ?? '').trim()
  if (!name) throw new ValidationError('Zone name is required')
  const lat = Number(data.latitude)
  const lng = Number(data.longitude)
  assertCoords(lat, lng)
  const radius = Math.min(5000, Math.max(50, Number(data.radius_m ?? 150)))
  const branchId = data.branch_id ? String(data.branch_id) : null
  const clockIn = data.clock_in_eligible !== false
  const db = getDb()
  const [row] = await db`
    INSERT INTO field_work_sites (branch_id, name, address, latitude, longitude, radius_m, is_active, clock_in_eligible)
    VALUES (${branchId}, ${name}, ${data.address ? String(data.address) : null}, ${lat}, ${lng}, ${radius}, true, ${clockIn})
    RETURNING id
  `
  const id = String(row.id)
  if (branchId) {
    await db`UPDATE branches SET default_latitude = ${lat}, default_longitude = ${lng} WHERE id = ${branchId}`
  }
  return (await getSite(id))!
}

export async function updateSite(id: string, data: Record<string, unknown>) {
  const existing = await getSite(id)
  if (!existing || !existing.is_active) throw new ValidationError('Work zone not found')
  const name = 'name' in data ? String(data.name).trim() : String(existing.name)
  const lat = 'latitude' in data ? Number(data.latitude) : Number(existing.latitude)
  const lng = 'longitude' in data ? Number(data.longitude) : Number(existing.longitude)
  assertCoords(lat, lng)
  const radius = 'radius_m' in data
    ? Math.min(5000, Math.max(50, Number(data.radius_m)))
    : Number(existing.radius_m)
  const branchId = 'branch_id' in data
    ? (data.branch_id ? String(data.branch_id) : null)
    : (existing.branch_id as string | null)
  const clockIn = 'clock_in_eligible' in data ? Boolean(data.clock_in_eligible) : Boolean(existing.clock_in_eligible)
  const db = getDb()
  await db`
    UPDATE field_work_sites SET branch_id = ${branchId}, name = ${name},
      address = ${data.address != null ? String(data.address) : existing.address},
      latitude = ${lat}, longitude = ${lng}, radius_m = ${radius}, clock_in_eligible = ${clockIn}
    WHERE id = ${id}
  `
  if (branchId) {
    await db`UPDATE branches SET default_latitude = ${lat}, default_longitude = ${lng} WHERE id = ${branchId}`
  }
  return (await getSite(id))!
}

export async function deleteSite(id: string) {
  const existing = await getSite(id)
  if (!existing) throw new ValidationError('Work zone not found')
  const db = getDb()
  await db`UPDATE field_work_sites SET is_active = false WHERE id = ${id}`
}

export async function branchCheckins(branchId?: string | null, limit = 100, date?: string | null) {
  let sql = `SELECT c.id, c.employee_id, c.site_id, c.latitude, c.longitude, c.address, c.attendance_id, c.notes, c.checked_in_at,
                    s.name AS site_name, e.emp_number, e.first_name, e.last_name
             FROM field_work_checkins c
             INNER JOIN employees e ON e.id = c.employee_id
             LEFT JOIN field_work_sites s ON s.id = c.site_id WHERE 1=1`
  const params: SqlValue[] = []
  if (branchId) {
    params.push(branchId)
    sql += ` AND e.branch_id = $${params.length}`
  }
  if (date) {
    params.push(date)
    sql += ` AND DATE(c.checked_in_at) = $${params.length}`
  }
  sql += ` ORDER BY c.checked_in_at DESC LIMIT ${Math.min(200, Math.max(1, limit))}`
  return unsafe(sql, params)
}

export async function myCheckins(employeeId: string, limit = 30) {
  const db = getDb()
  const lim = Math.min(100, Math.max(1, limit))
  return db.unsafe(
    `SELECT c.id, c.employee_id, c.site_id, c.latitude, c.longitude, c.address, c.attendance_id, c.notes, c.checked_in_at,
            s.name AS site_name
     FROM field_work_checkins c
     LEFT JOIN field_work_sites s ON s.id = c.site_id
     WHERE c.employee_id = $1 ORDER BY c.checked_in_at DESC LIMIT ${lim}`,
    [employeeId],
  )
}
