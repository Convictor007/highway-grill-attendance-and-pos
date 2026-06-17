import { getDb } from './db'
import { unsafe, type SqlValue } from './sql'

export async function list(employeeId?: string | null) {
  const params: SqlValue[] = []
  let sql = `SELECT o.*, e.emp_number, e.first_name, e.last_name
    FROM overtime_requests o INNER JOIN employees e ON e.id = o.employee_id WHERE 1=1`
  if (employeeId) {
    params.push(employeeId)
    sql += ` AND o.employee_id = $${params.length}`
  }
  sql += ' ORDER BY o.created_at DESC'
  return unsafe(sql, params)
}

export async function create(data: Record<string, unknown>) {
  const db = getDb()
  const [row] = await db`
    INSERT INTO overtime_requests (employee_id, request_date, extra_hours, reason, status)
    VALUES (${String(data.employee_id)}, ${String(data.request_date)}, ${Number(data.extra_hours)},
      ${data.reason ? String(data.reason) : null}, 'pending')
    RETURNING id
  `
  const rows = await db`SELECT * FROM overtime_requests WHERE id = ${row.id}`
  return rows[0]
}

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
