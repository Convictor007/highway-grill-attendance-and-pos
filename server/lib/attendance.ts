import { getDb } from './db'
import { branchWallClockToUtcIso } from './branch-time'
import { ValidationError } from './errors'
import * as fieldWork from './field-work'
import * as auto from './attendance-auto'
import { upsertAutoFromAttendance } from './overtime'
import { unsafe, unsafeExec, type SqlValue } from './sql'
import { mondayThisWeek, todayIso } from './date-utils'
import { resolveAssignmentShiftName } from './shifts'

const ATT_LIST = `SELECT a.*, e.emp_number, e.first_name, e.last_name, e.branch_id
  FROM attendance a INNER JOIN employees e ON e.id = a.employee_id`

const ATT_ONE = `SELECT a.*, e.emp_number, e.first_name, e.last_name
  FROM attendance a INNER JOIN employees e ON e.id = a.employee_id`

export async function listAttendance(date?: string | null, branchId?: string | null, employeeId?: string | null) {
  const d = date ?? todayIso()
  const params: SqlValue[] = [d, d, d, d]
  let sql = `${ATT_LIST} WHERE (
    DATE(a.clock_in) = $1 OR (a.clock_out IS NOT NULL AND DATE(a.clock_out) = $2)
    OR (a.clock_in < ($3::date + INTERVAL '1 day') AND (a.clock_out IS NULL OR a.clock_out >= $4))
  )`
  if (employeeId) {
    params.push(employeeId)
    sql += ` AND a.employee_id = $${params.length}`
  }
  if (branchId) {
    params.push(branchId)
    sql += ` AND e.branch_id = $${params.length}`
  }
  sql += ' ORDER BY a.clock_in'
  return unsafe(sql, params)
}

export const openSession = auto.openSession

export async function getAttendance(id: string) {
  const rows = await unsafe(`${ATT_ONE} WHERE a.id = $1 LIMIT 1`, [id])
  return rows[0] ?? null
}

async function employeeBranchId(employeeId: string) {
  const db = getDb()
  const rows = await db`SELECT branch_id FROM employees WHERE id = ${employeeId} LIMIT 1`
  return rows[0]?.branch_id ? String(rows[0].branch_id) : null
}

async function isManagementEmployee(employeeId: string) {
  const db = getDb()
  const rows = await db`
    SELECT r.role_slug FROM users u INNER JOIN roles r ON r.role_id = u.role_id
    WHERE u.employee_id = ${employeeId} AND u.is_active = true LIMIT 1
  `
  const slug = rows[0]?.role_slug
  return slug === 'admin' || slug === 'hr'
}

async function isDeliveryRider(employeeId: string) {
  const db = getDb()
  const rows = await db`
    SELECT p.title, d.name AS department_name FROM employees e
    LEFT JOIN positions p ON p.id = e.position_id
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE e.id = ${employeeId} LIMIT 1
  `
  const title = String(rows[0]?.title ?? '').toLowerCase()
  const dept = String(rows[0]?.department_name ?? '').toLowerCase()
  return dept.includes('delivery') || title.includes('delivery') || title.includes('rider')
}

async function employeePositionLabel(employeeId: string) {
  const db = getDb()
  const rows = await db`
    SELECT p.title, d.name AS department_name FROM employees e
    LEFT JOIN positions p ON p.id = e.position_id
    LEFT JOIN departments d ON d.id = e.department_id WHERE e.id = ${employeeId} LIMIT 1
  `
  const title = String(rows[0]?.title ?? '').trim()
  if (title) return title
  return String(rows[0]?.department_name ?? '').trim() || null
}

export async function clockPolicyForEmployee(employeeId: string) {
  if (await isManagementEmployee(employeeId)) {
    return { geofence_required: false, clock_in_exempt: true, mobile_clock: true, position_label: 'Management' }
  }
  if (await isDeliveryRider(employeeId)) {
    return { geofence_required: false, clock_in_exempt: false, mobile_clock: true, position_label: 'Delivery' }
  }
  const branchId = await employeeBranchId(employeeId)
  const required = await fieldWork.branchHasClockInZones(branchId)
  return {
    geofence_required: required,
    clock_in_exempt: false,
    mobile_clock: false,
    position_label: await employeePositionLabel(employeeId),
  }
}

async function assertGeofenceForClockIn(
  employeeId: string,
  latitude?: number | null,
  longitude?: number | null,
  accuracyM?: number | null,
) {
  const policy = await clockPolicyForEmployee(employeeId)
  if (!policy.geofence_required) return
  const branchId = await employeeBranchId(employeeId)
  if (!(await fieldWork.branchHasClockInZones(branchId))) return
  if (latitude == null || longitude == null) {
    throw new ValidationError(
      'Location access is required to clock in. Tap Enable location on the time clock, allow browser GPS, then try again.',
    )
  }
  const match = await fieldWork.matchClockInSite(latitude, longitude, branchId, accuracyM)
  if (!match) {
    const status = await fieldWork.zoneStatus(latitude, longitude, branchId, true, accuracyM)
    throw new ValidationError('You must be inside the registered work zone to clock in.')
  }
}

export async function clockIn(
  employeeId: string,
  method = 'app',
  latitude?: number | null,
  longitude?: number | null,
  address?: string | null,
  accuracyM?: number | null,
) {
  if (await openSession(employeeId)) {
    throw new ValidationError('You are already clocked in — tap Clock out to end this session.')
  }
  await assertGeofenceForClockIn(employeeId, latitude, longitude, accuracyM)
  const db = getDb()
  const [row] = await db`
    INSERT INTO attendance (employee_id, clock_in, method, latitude, longitude, clock_in_address)
    VALUES (${employeeId}, NOW(), ${method}, ${latitude ?? null}, ${longitude ?? null}, ${address ?? null})
    RETURNING id
  `
  const id = String(row.id)
  await auto.linkShiftOnClockIn(id, employeeId)
  return (await getAttendance(id))!
}

export async function clockOut(
  employeeId: string,
  latitude?: number | null,
  longitude?: number | null,
  address?: string | null,
) {
  return auto.manualClockOut(employeeId, latitude, longitude, address)
}

/** Remove an open session with no hours — accidental clock-in on day off, etc. */
export async function cancelMistakenClockIn(employeeId: string) {
  const open = await openSession(employeeId)
  if (!open) throw new ValidationError('You are not clocked in')

  const db = getDb()
  try {
    await db`DELETE FROM overtime_requests WHERE attendance_id = ${open.id}`
  } catch {
    /* attendance_id column optional on older DBs */
  }
  const deleted = await db`
    DELETE FROM attendance
    WHERE id = ${open.id} AND employee_id = ${employeeId} AND clock_out IS NULL
  `
  if (Number(deleted.count) === 0) {
    throw new ValidationError('Could not cancel clock-in')
  }
  return { cancelled: true }
}

export async function breakStart(employeeId: string) {
  const open = await openSession(employeeId)
  if (!open) throw new Error('Clock in before starting a break')
  if (open.break_start && !open.break_end) throw new Error('Break already in progress')
  const db = getDb()
  await db`UPDATE attendance SET break_start = NOW(), break_end = NULL WHERE id = ${open.id}`
  return (await getAttendance(String(open.id)))!
}

export async function breakEnd(employeeId: string) {
  const open = await openSession(employeeId)
  if (!open || !open.break_start || open.break_end) throw new Error('No break in progress')
  const db = getDb()
  await db`UPDATE attendance SET break_end = NOW() WHERE id = ${open.id}`
  return (await getAttendance(String(open.id)))!
}

export async function hoursSummary(employeeId: string, from: string, to: string) {
  const db = getDb()
  const rows = await db`
    SELECT COALESCE(SUM(actual_hours), 0) AS total_hours, COUNT(*) AS shift_count
    FROM attendance
    WHERE employee_id = ${employeeId} AND DATE(clock_in) BETWEEN ${from} AND ${to} AND clock_out IS NOT NULL
  `
  return {
    from,
    to,
    total_hours: Number(rows[0]?.total_hours ?? 0),
    shift_count: Number(rows[0]?.shift_count ?? 0),
  }
}

export async function employeeHistory(employeeId: string, from: string, to: string) {
  return unsafe(
    `${ATT_LIST} WHERE a.employee_id = $1 AND DATE(a.clock_in) BETWEEN $2 AND $3 ORDER BY a.clock_in DESC`,
    [employeeId, from, to],
  )
}

export async function scheduledShiftForEmployee(employeeId: string, date: string) {
  const db = getDb()
  const rows = await db`
    SELECT sa.*, st.name AS shift_name, COALESCE(sa.break_mins, st.break_mins, 0) AS break_mins
    FROM shift_assignments sa
    INNER JOIN schedules sch ON sch.id = sa.schedule_id AND sch.status IN ('published', 'locked', 'draft')
    LEFT JOIN shift_templates st ON st.id = sa.shift_template_id
    WHERE sa.employee_id = ${employeeId} AND sa.shift_date = ${date}
      AND (sa.notes IS NULL OR sa.notes != 'REST_DAY')
    ORDER BY sa.start_time LIMIT 1
  `
  const row = rows[0]
  if (!row) return null
  const start = String(row.start_time).slice(0, 8)
  const end = String(row.end_time).slice(0, 8)
  const emp = await db`SELECT branch_id FROM employees WHERE id = ${employeeId} LIMIT 1`
  const branchId = emp[0]?.branch_id ? String(emp[0].branch_id) : null
  const templates = branchId
    ? await db`SELECT id, name, start_time, end_time FROM shift_templates WHERE branch_id = ${branchId}`
    : []
  const shiftName = resolveAssignmentShiftName(templates, row.start_time, row.end_time, row.shift_name)
  const endDate = end <= start ? new Date(date + 'T12:00:00') : new Date(date + 'T12:00:00')
  if (end <= start) endDate.setDate(endDate.getDate() + 1)
  const endDateStr = endDate.toISOString().slice(0, 10)
  const breakMins = Number(row.break_mins ?? 0)
  const rawHours = (new Date(`${endDateStr}T${end}`).getTime() - new Date(`${date}T${start}`).getTime()) / 3600000
  return {
    assignment_id: row.id,
    shift_name: shiftName,
    shift_date: date,
    start_time: row.start_time,
    end_time: row.end_time,
    break_mins: breakMins,
    suggested_hours: Math.round(Math.max(0, rawHours - breakMins / 60) * 100) / 100,
    off_day: false,
  }
}

export async function statistics(branchId: string | null, from: string, to: string) {
  const params: SqlValue[] = []
  let empSql = `SELECT COUNT(*)::int AS c FROM employees WHERE status = 'active'`
  if (branchId) {
    params.push(branchId)
    empSql += ` AND branch_id = $${params.length}`
  }
  const empRows = await unsafe<{ c: number }>(empSql, params)
  const activeEmployees = empRows[0]?.c ?? 0

  const attParams: SqlValue[] = [from, to]
  let attSql = `SELECT e.id, e.emp_number, e.first_name, e.last_name,
    COALESCE(SUM(a.actual_hours), 0) AS total_hours,
    COUNT(DISTINCT DATE(a.clock_in))::int AS days_present
    FROM employees e
    LEFT JOIN attendance a ON a.employee_id = e.id AND DATE(a.clock_in) BETWEEN $1 AND $2 AND a.clock_out IS NOT NULL
    WHERE e.status = 'active'`
  if (branchId) {
    attParams.push(branchId)
    attSql += ` AND e.branch_id = $${attParams.length}`
  }
  attSql += ' GROUP BY e.id ORDER BY e.last_name'
  const byEmployee = await unsafe(attSql, attParams)
  let totalHours = 0
  let totalDays = 0
  for (const row of byEmployee) {
    totalHours += Number(row.total_hours)
    totalDays += Number(row.days_present)
  }
  const periodDays = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1)
  const expectedSlots = activeEmployees * periodDays
  return {
    from,
    to,
    active_employees: activeEmployees,
    total_hours: Math.round(totalHours * 100) / 100,
    avg_hours_per_employee: activeEmployees > 0 ? Math.round((totalHours / activeEmployees) * 100) / 100 : 0,
    total_days_present: totalDays,
    attendance_rate: expectedSlots > 0 ? Math.round((totalDays / expectedSlots) * 1000) / 10 : 0,
    holiday_hours_worked: 0,
    approved_overtime_hours: 0,
    by_employee: byEmployee,
  }
}

export async function updateAttendance(id: string, data: Record<string, unknown>, approverUserId?: string | null) {
  const existing = await getAttendance(id)
  if (!existing) return null
  const fields = ['clock_in', 'clock_out', 'actual_hours', 'regular_hours', 'overtime_hours', 'method', 'clock_in_address', 'clock_out_address', 'shift_assignment_id']
  const updates: Record<string, unknown> = {}
  for (const f of fields) {
    if (f in data) updates[f] = data[f]
  }
  // Manual time edits arrive as branch-local wall-clock — store true UTC instants.
  if ('clock_in' in updates) updates.clock_in = branchWallClockToUtcIso(updates.clock_in)
  if ('clock_out' in updates) updates.clock_out = branchWallClockToUtcIso(updates.clock_out)
  if (Object.keys(updates).length === 0) return existing
  if (approverUserId) {
    updates.approved_by = approverUserId
    updates.approved_at = new Date().toISOString()
  }
  const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ')
  await unsafeExec(`UPDATE attendance SET ${sets} WHERE id = $1`, [id, ...Object.values(updates) as SqlValue[]])
  if ('regular_hours' in data || 'overtime_hours' in data) {
    const row = await getAttendance(id)
    if (row) {
      // Sync auto OT: write the corrected hours, or clear the row when set to 0.
      const ot = Number(row.overtime_hours ?? 0)
      await upsertAutoFromAttendance(id, String(row.employee_id), String(row.clock_in).slice(0, 10), ot, 'HR attendance correction')
    }
    return row
  }
  return auto.recalculateForRecord(id)
}

/**
 * Create an attendance record manually (HR-approved correction for a forgotten
 * punch). Leaves shift_assignment_id NULL so hours resolve against the shift for
 * the record's own date, then recomputes hours when a clock-out is supplied.
 */
export async function createManualAttendance(
  employeeId: string,
  clockIn: string,
  clockOut: string | null,
  approverUserId: string,
) {
  const db = getDb()
  // Branch-local wall-clock from correction forms → true UTC instants.
  const clockInIso = branchWallClockToUtcIso(clockIn)
  const clockOutIso = branchWallClockToUtcIso(clockOut)
  const [row] = await db`
    INSERT INTO attendance (employee_id, clock_in, clock_out, method, approved_by, approved_at, clock_out_type)
    VALUES (${employeeId}, ${clockInIso}, ${clockOutIso}, 'manual', ${approverUserId}, NOW(), ${clockOutIso ? 'manual' : null})
    RETURNING id
  `
  const id = String(row.id)
  if (clockOutIso) {
    await auto.recalculateForRecord(id)
  }
  return getAttendance(id)
}

export function defaultHistoryFrom() {
  const d = new Date()
  d.setDate(d.getDate() - 13)
  return d.toISOString().slice(0, 10)
}

export function defaultSummaryFrom() {
  return mondayThisWeek()
}
