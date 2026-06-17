import { getDb } from './db'
import { ValidationError } from './errors'
import { createNotification, userIdForEmployee } from './notifications'
import { unsafe, unsafeExec, type SqlValue } from './sql'

export async function ensureBalancesForEmployee(employeeId: string, year: number): Promise<void> {
  const db = getDb()
  const types = await db`SELECT id, days_per_year FROM leave_types`
  for (const type of types) {
    const existing = await db`
      SELECT id FROM leave_balances
      WHERE employee_id = ${employeeId} AND leave_type_id = ${type.id} AND year = ${year}
      LIMIT 1
    `
    if (existing.length > 0) continue
    await db`
      INSERT INTO leave_balances (employee_id, leave_type_id, year, accrued, used, pending, carried_forward)
      VALUES (${employeeId}, ${type.id}, ${year}, ${type.days_per_year}, 0, 0, 0)
    `
  }
}

export async function types() {
  const db = getDb()
  return db`SELECT * FROM leave_types ORDER BY name`
}

export async function balances(employeeId?: string | null, year?: number | null) {
  const yr = year ?? new Date().getFullYear()
  if (employeeId) await ensureBalancesForEmployee(employeeId, yr)
  const params: SqlValue[] = [yr]
  let sql = `SELECT lb.*, lt.name AS leave_type_name, e.first_name, e.last_name, e.emp_number
    FROM leave_balances lb
    INNER JOIN leave_types lt ON lt.id = lb.leave_type_id
    INNER JOIN employees e ON e.id = lb.employee_id
    WHERE lb.year = $1`
  if (employeeId) {
    params.push(employeeId)
    sql += ` AND lb.employee_id = $${params.length}`
  }
  sql += ' ORDER BY e.last_name, lt.name'
  return unsafe(sql, params)
}

export async function requests(employeeId?: string | null, status?: string | null) {
  const params: SqlValue[] = []
  let sql = `SELECT lr.*, lt.name AS leave_type_name, e.first_name, e.last_name, e.emp_number
    FROM leave_requests lr
    INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
    INNER JOIN employees e ON e.id = lr.employee_id WHERE 1=1`
  if (employeeId) {
    params.push(employeeId)
    sql += ` AND lr.employee_id = $${params.length}`
  }
  if (status) {
    params.push(status)
    sql += ` AND lr.status = $${params.length}`
  }
  sql += ' ORDER BY lr.created_at DESC'
  return unsafe(sql, params)
}

export async function createType(data: Record<string, unknown>) {
  const db = getDb()
  const [row] = await db`
    INSERT INTO leave_types (name, paid, days_per_year, carry_forward, requires_approval, color_hex)
    VALUES (${String(data.name)}, ${Boolean(data.paid)}, ${Number(data.days_per_year ?? 0)},
      ${Boolean(data.carry_forward)}, ${data.requires_approval !== false}, ${data.color_hex ? String(data.color_hex) : '#378ADD'})
    RETURNING id
  `
  const rows = await db`SELECT * FROM leave_types WHERE id = ${row.id}`
  return rows[0]
}

export async function updateType(id: string, data: Record<string, unknown>) {
  const fields = ['name', 'days_per_year', 'color_hex']
  const updates: Record<string, unknown> = {}
  for (const f of fields) if (f in data) updates[f] = data[f]
  for (const bool of ['paid', 'carry_forward', 'requires_approval']) {
    if (bool in data) updates[bool] = Boolean(data[bool])
  }
  if (Object.keys(updates).length === 0) {
    const rows = await getDb()`SELECT * FROM leave_types WHERE id = ${id}`
    return rows[0] ?? null
  }
  const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ')
  await unsafeExec(`UPDATE leave_types SET ${sets} WHERE id = $1`, [id, ...Object.values(updates) as SqlValue[]])
  const rows = await getDb()`SELECT * FROM leave_types WHERE id = ${id}`
  return rows[0] ?? null
}

export async function createRequest(data: Record<string, unknown>) {
  const employeeId = String(data.employee_id)
  const leaveTypeId = String(data.leave_type_id)
  const startDate = String(data.start_date)
  const endDate = String(data.end_date)
  const daysCount = Number(data.days_count)
  const year = new Date(startDate).getFullYear()
  await ensureBalancesForEmployee(employeeId, year)
  const db = getDb()
  let requestId: number | undefined
  await db.begin(async (tx) => {
    const [row] = await tx`
      INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, days_count, reason, status)
      VALUES (${employeeId}, ${leaveTypeId}, ${startDate}, ${endDate}, ${daysCount},
        ${data.reason ? String(data.reason) : null}, 'pending')
      RETURNING id
    `
    requestId = row.id
    await tx`
      UPDATE leave_balances SET pending = pending + ${daysCount}
      WHERE employee_id = ${employeeId} AND leave_type_id = ${leaveTypeId} AND year = ${year}
    `
  })
  const rows = await db`SELECT * FROM leave_requests WHERE id = ${requestId!}`
  return rows[0]
}

async function notifyLeaveDecision(row: Record<string, unknown>, status: string) {
  const uid = await userIdForEmployee(String(row.employee_id))
  if (!uid) return
  const db = getDb()
  const typeRows = await db`SELECT name FROM leave_types WHERE id = ${String(row.leave_type_id)} LIMIT 1`
  const typeName = typeRows[0]?.name ? String(typeRows[0].name) : 'Leave'
  const range = `${row.start_date} – ${row.end_date}`
  if (status === 'approved') {
    await createNotification(uid, 'leave_approved', 'Leave approved', `Your ${typeName} request (${range}) was approved.`, String(row.id), '/leaves')
    return
  }
  await createNotification(uid, 'leave_rejected', 'Leave declined', `Your ${typeName} request (${range}) was declined.`, String(row.id), '/leaves')
}

export async function review(id: string, status: string, reviewerId: string, notes?: string | null) {
  if (!['approved', 'rejected', 'cancelled'].includes(status)) {
    throw new ValidationError('Invalid status')
  }
  const db = getDb()
  const reqRows = await db`
    SELECT employee_id, leave_type_id, days_count, start_date, status FROM leave_requests WHERE id = ${id}
  `
  const row = reqRows[0]
  if (!row) return null

  await db`UPDATE leave_requests SET status = ${status}, reviewed_by = ${reviewerId}, reviewed_at = NOW(), notes = ${notes ?? null} WHERE id = ${id}`

  if (String(row.status) === 'pending') {
    const year = new Date(String(row.start_date)).getFullYear()
    const d = Number(row.days_count)
    if (status === 'approved') {
      await ensureBalancesForEmployee(String(row.employee_id), year)
      await db`
        UPDATE leave_balances SET used = used + ${d}, pending = GREATEST(pending - ${d}, 0)
        WHERE employee_id = ${String(row.employee_id)} AND leave_type_id = ${String(row.leave_type_id)} AND year = ${year}
      `
    } else if (status === 'rejected' || status === 'cancelled') {
      await db`
        UPDATE leave_balances SET pending = GREATEST(pending - ${d}, 0)
        WHERE employee_id = ${String(row.employee_id)} AND leave_type_id = ${String(row.leave_type_id)} AND year = ${year}
      `
    }
  }

  const out = await db`SELECT * FROM leave_requests WHERE id = ${id}`
  const result = out[0] ?? null
  if (result && (status === 'approved' || status === 'rejected')) {
    await notifyLeaveDecision(result, status)
  }
  return result
}

export async function cancelRequest(id: string, employeeId: string) {
  const db = getDb()
  const rows = await db`SELECT * FROM leave_requests WHERE id = ${id} LIMIT 1`
  const row = rows[0]
  if (!row || String(row.employee_id) !== employeeId) return null
  if (String(row.status) !== 'pending') {
    throw new ValidationError('Only pending requests can be cancelled')
  }
  const year = new Date(String(row.start_date)).getFullYear()
  await db`UPDATE leave_requests SET status = 'cancelled', reviewed_at = NOW() WHERE id = ${id}`
  await db`
    UPDATE leave_balances SET pending = GREATEST(pending - ${Number(row.days_count)}, 0)
    WHERE employee_id = ${String(row.employee_id)} AND leave_type_id = ${String(row.leave_type_id)} AND year = ${year}
  `
  const out = await db`SELECT * FROM leave_requests WHERE id = ${id}`
  return out[0] ?? null
}
