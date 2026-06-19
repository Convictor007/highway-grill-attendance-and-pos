import { getDb } from './db'
import * as fieldWork from './field-work'
import {
  computeHourSplit,
  resolveShiftTiming,
  timingToDbColumns,
  workedHours,
  type ShiftAssignment,
} from './attendance-timing'
import { upsertAutoFromAttendance } from './overtime'
import { unsafe } from './sql'

const ATT_SELECT = `SELECT a.*, e.emp_number, e.first_name, e.last_name FROM attendance a
  INNER JOIN employees e ON e.id = a.employee_id`

export { MAX_REGULAR_HOURS } from './attendance-timing'
export const OUTSIDE_MINUTES = 5
const ENDING_SOON_MINUTES = 30

async function getRecord(id: string) {
  const rows = await unsafe(`${ATT_SELECT} WHERE a.id = $1 LIMIT 1`, [id])
  return rows[0] ?? null
}

async function openSession(employeeId: string) {
  const db = getDb()
  const rows = await db`
    SELECT * FROM attendance WHERE employee_id = ${employeeId} AND clock_out IS NULL
    ORDER BY clock_in DESC LIMIT 1
  `
  return rows[0] ?? null
}

async function resolveShift(record: Record<string, unknown>, employeeId: string): Promise<ShiftAssignment | null> {
  const db = getDb()
  if (record.shift_assignment_id) {
    const rows = await db`
      SELECT shift_date, start_time, end_time FROM shift_assignments
      WHERE id = ${String(record.shift_assignment_id)} LIMIT 1
    `
    if (rows[0]) return rows[0] as ShiftAssignment
  }
  const date = String(record.clock_in).slice(0, 10)
  const rows = await db`
    SELECT shift_date, start_time, end_time FROM shift_assignments
    WHERE employee_id = ${employeeId} AND shift_date = ${date}
    ORDER BY start_time LIMIT 1
  `
  return (rows[0] as ShiftAssignment | undefined) ?? null
}

async function closeSession(
  open: Record<string, unknown>,
  clockOutAt: string,
  clockOutType: string,
  latitude?: number | null,
  longitude?: number | null,
  address?: string | null,
) {
  const worked = workedHours(String(open.clock_in), clockOutAt, open)
  const fullRecord = { ...open, clock_out: clockOutAt, actual_hours: worked }
  const shift = await resolveShift(fullRecord, String(open.employee_id))
  const split = computeHourSplit(fullRecord, shift)
  const timingCols = timingToDbColumns(split.timing)
  const db = getDb()
  await db`
    UPDATE attendance SET
      clock_out = ${clockOutAt},
      actual_hours = ${worked},
      regular_hours = ${split.regular},
      overtime_hours = ${split.overtime},
      early_in_minutes = ${timingCols.early_in_minutes},
      late_in_minutes = ${timingCols.late_in_minutes},
      early_out_minutes = ${timingCols.early_out_minutes},
      late_out_minutes = ${timingCols.late_out_minutes},
      clock_out_type = ${clockOutType},
      outside_since = NULL,
      latitude = COALESCE(${latitude ?? null}, latitude),
      longitude = COALESCE(${longitude ?? null}, longitude),
      clock_out_address = COALESCE(${address ?? null}, clock_out_address)
    WHERE id = ${String(open.id)}
  `
  if (split.overtime > 0) {
    await upsertAutoFromAttendance(
      String(open.id),
      String(open.employee_id),
      String(open.clock_in).slice(0, 10),
      split.overtime,
      `${split.reason} (${clockOutType})`,
    )
  }
  return (await getRecord(String(open.id)))!
}

function isPastMidnight(clockIn: string, clockOut: string): boolean {
  return clockOut.slice(0, 10) > clockIn.slice(0, 10)
}

export async function linkShiftOnClockIn(attendanceId: string, employeeId: string) {
  const today = new Date().toISOString().slice(0, 10)
  const db = getDb()
  const shifts = await db`
    SELECT sa.id FROM shift_assignments sa
    INNER JOIN schedules sch ON sch.id = sa.schedule_id AND sch.status IN ('published', 'locked', 'draft')
    WHERE sa.employee_id = ${employeeId} AND sa.shift_date = ${today}
      AND (sa.notes IS NULL OR sa.notes != 'REST_DAY')
    ORDER BY sa.start_time LIMIT 1
  `
  if (shifts[0]) {
    await db`UPDATE attendance SET shift_assignment_id = ${shifts[0].id} WHERE id = ${attendanceId}`
  }
}

export async function manualClockOut(
  employeeId: string,
  latitude?: number | null,
  longitude?: number | null,
  address?: string | null,
) {
  const open = await openSession(employeeId)
  if (!open) throw new Error('No open attendance session')
  const branchRows = await getDb()`SELECT branch_id FROM employees WHERE id = ${employeeId} LIMIT 1`
  const branchId = branchRows[0]?.branch_id as string | undefined
  const geofenceRequired = await fieldWork.branchHasClockInZones(branchId ? String(branchId) : null)
  let inside = !geofenceRequired
  if (!inside && latitude != null && longitude != null) {
    const match = await fieldWork.matchClockInSite(latitude, longitude, branchId ? String(branchId) : null)
    inside = match != null
  }
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const closed = await closeSession(open, now, 'manual', latitude, longitude, address)
  if (inside && isPastMidnight(String(open.clock_in), now) && branchId) {
    const others = await getDb()`
      SELECT a.* FROM attendance a
      INNER JOIN employees e ON e.id = a.employee_id
      WHERE a.clock_out IS NULL AND e.branch_id = ${branchId} AND a.employee_id != ${employeeId}
    `
    for (const o of others) {
      await closeSession(o, now, 'auto_midnight_cascade', null, null, null)
    }
  }
  return closed
}

export async function recalculateForRecord(attendanceId: string) {
  const row = await getRecord(attendanceId)
  if (!row?.clock_out) return row
  const shift = await resolveShift(row, String(row.employee_id))
  const split = computeHourSplit(row, shift)
  const timingCols = timingToDbColumns(split.timing)
  const db = getDb()
  await db`
    UPDATE attendance SET
      actual_hours = ${split.worked},
      regular_hours = ${split.regular},
      overtime_hours = ${split.overtime},
      early_in_minutes = ${timingCols.early_in_minutes},
      late_in_minutes = ${timingCols.late_in_minutes},
      early_out_minutes = ${timingCols.early_out_minutes},
      late_out_minutes = ${timingCols.late_out_minutes}
    WHERE id = ${attendanceId}
  `
  if (split.overtime > 0) {
    await upsertAutoFromAttendance(
      attendanceId,
      String(row.employee_id),
      String(row.clock_in).slice(0, 10),
      split.overtime,
      split.reason,
    )
  }
  return getRecord(attendanceId)
}

export async function shiftContextForEmployee(employeeId: string) {
  const open = await openSession(employeeId)
  if (!open) return null

  const shift = await resolveShift(open, employeeId)
  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const timing = resolveShiftTiming({ ...open, clock_out: nowStr }, shift)
  const worked = workedHours(String(open.clock_in), nowStr, open)
  const nowTs = Date.now()
  const expectedEndTs = timing.expected_end_ts
  const minutesUntilEnd =
    expectedEndTs != null ? Math.round((expectedEndTs - nowTs) / 60_000) : null

  let phase: 'normal' | 'ending_soon' | 'overdue' = 'normal'
  if (minutesUntilEnd != null) {
    if (minutesUntilEnd <= 0) phase = 'overdue'
    else if (minutesUntilEnd <= ENDING_SOON_MINUTES) phase = 'ending_soon'
  }

  const hasShift = Boolean(shift?.shift_date && shift.start_time && shift.end_time)
  const startLabel = hasShift ? String(shift!.start_time).slice(0, 5) : null
  const endLabel = hasShift ? String(shift!.end_time).slice(0, 5) : null
  const expectedEndLabel =
    expectedEndTs != null
      ? new Date(expectedEndTs).toISOString().replace('T', ' ').slice(11, 16)
      : null

  return {
    has_shift: hasShift,
    shift_label: hasShift && startLabel && endLabel ? `${startLabel}–${endLabel}` : null,
    shift_date: hasShift ? String(shift!.shift_date).slice(0, 10) : null,
    shift_start: startLabel,
    shift_end: endLabel,
    expected_shift_end: expectedEndLabel,
    late_minutes: timing.late_in_minutes ?? 0,
    early_minutes: timing.early_in_minutes ?? 0,
    minutes_until_end: minutesUntilEnd,
    phase,
    show_end_shift: phase === 'ending_soon' || phase === 'overdue',
    hours_worked: worked,
  }
}

export async function vicinityPing(
  employeeId: string,
  latitude: number,
  longitude: number,
  accuracyM?: number | null,
) {
  const open = await openSession(employeeId)
  if (!open) {
    return { auto_clocked_out: false, session: null, shift: null, vicinity: { inside: false, geofence_active: false } }
  }
  const shift = await shiftContextForEmployee(employeeId)
  const branchRows = await getDb()`SELECT branch_id FROM employees WHERE id = ${employeeId} LIMIT 1`
  const branchId = branchRows[0]?.branch_id ? String(branchRows[0].branch_id) : null
  const hasZones = await fieldWork.branchHasClockInZones(branchId)
  if (!hasZones) {
    return {
      auto_clocked_out: false,
      session: open,
      shift,
      vicinity: { inside: true, geofence_active: false },
    }
  }
  const match = await fieldWork.matchClockInSite(latitude, longitude, branchId, accuracyM)
  const inside = match != null
  if (inside) {
    await getDb()`UPDATE attendance SET outside_since = NULL WHERE id = ${open.id}`
    return { auto_clocked_out: false, session: await getRecord(String(open.id)), shift, vicinity: { inside: true, geofence_active: true } }
  }
  let outsideSince = open.outside_since ? String(open.outside_since) : null
  if (!outsideSince) {
    outsideSince = new Date().toISOString().replace('T', ' ').slice(0, 19)
    await getDb()`UPDATE attendance SET outside_since = ${outsideSince} WHERE id = ${open.id}`
  }
  const elapsed = Date.now() - new Date(outsideSince.replace(' ', 'T') + 'Z').getTime()
  const pastMidnight = isPastMidnight(String(open.clock_in), new Date().toISOString().slice(0, 19))
  if (elapsed >= OUTSIDE_MINUTES * 60 * 1000 && pastMidnight) {
    const clockOutAt = new Date(new Date(outsideSince.replace(' ', 'T') + 'Z').getTime() + OUTSIDE_MINUTES * 60 * 1000)
      .toISOString().replace('T', ' ').slice(0, 19)
    const closed = await closeSession(open, clockOutAt, 'auto_outside', latitude, longitude, null)
    return { auto_clocked_out: true, session: closed, shift, vicinity: { inside: false, geofence_active: true, outside_since: outsideSince } }
  }
  return {
    auto_clocked_out: false,
    session: await getRecord(String(open.id)),
    shift,
    vicinity: { inside: false, geofence_active: true, outside_since: outsideSince, outside_grace_minutes: OUTSIDE_MINUTES },
  }
}
