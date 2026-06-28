import { getDb } from './db'

/** Remove the auto-generated OT row for an attendance record (used when OT drops to 0). */
export async function clearAutoOvertime(attendanceId: string): Promise<void> {
  const db = getDb()
  await db`
    DELETE FROM overtime_requests
    WHERE attendance_id = ${attendanceId} AND source = 'auto'
  `
}

export async function upsertAutoFromAttendance(
  attendanceId: string,
  employeeId: string,
  requestDate: string,
  extraHours: number,
  reason: string,
): Promise<void> {
  // OT no longer applies (e.g. HR correction or auto-close) — drop any stale auto row
  // so payroll does not keep paying overtime that was recalculated away.
  if (extraHours <= 0) {
    await clearAutoOvertime(attendanceId)
    return
  }
  const db = getDb()
  const existing = await db`
    SELECT id FROM overtime_requests
    WHERE attendance_id = ${attendanceId} AND source = 'auto'
    LIMIT 1
  `
  if (existing[0]) {
    await db`
      UPDATE overtime_requests
      SET extra_hours = ${extraHours}, reason = ${reason}, status = 'approved'
      WHERE id = ${existing[0].id}
    `
    return
  }
  await db`
    INSERT INTO overtime_requests (employee_id, request_date, extra_hours, reason, status, source, attendance_id)
    VALUES (${employeeId}, ${requestDate}, ${extraHours}, ${reason}, 'approved', 'auto', ${attendanceId})
  `
}
