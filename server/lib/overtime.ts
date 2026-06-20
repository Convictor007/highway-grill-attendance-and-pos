import { getDb } from './db'

export async function upsertAutoFromAttendance(
  attendanceId: string,
  employeeId: string,
  requestDate: string,
  extraHours: number,
  reason: string,
): Promise<void> {
  if (extraHours <= 0) return
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
