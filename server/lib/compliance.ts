import { getDb } from './db'
import { ValidationError } from './errors'
import { unsafe, unsafeExec, type SqlValue } from './sql'

export async function checklists() {
  const db = getDb()
  return db`SELECT * FROM compliance_checklists ORDER BY checklist_type, name`
}

export async function logs(branchId?: string | null, limit = 50) {
  const lim = Math.max(1, Math.min(limit, 200))
  const params: SqlValue[] = []
  let sql = `SELECT cl.*, cc.name AS checklist_name, cc.checklist_type, cc.frequency,
    b.name AS branch_name, e.first_name, e.last_name, e.emp_number
    FROM compliance_logs cl
    INNER JOIN compliance_checklists cc ON cc.id = cl.checklist_id
    INNER JOIN branches b ON b.id = cl.branch_id
    LEFT JOIN employees e ON e.id = cl.completed_by
    WHERE 1=1`
  if (branchId) {
    params.push(branchId)
    sql += ` AND cl.branch_id = $${params.length}`
  }
  sql += ` ORDER BY cl.completed_at DESC LIMIT ${lim}`
  return unsafe(sql, params)
}

export async function createLog(data: Record<string, unknown>, employeeId?: string | null) {
  const db = getDb()
  const [row] = await db`
    INSERT INTO compliance_logs (checklist_id, branch_id, completed_by, completed_at, status, notes)
    VALUES (${String(data.checklist_id)}, ${String(data.branch_id)}, ${employeeId ?? null},
      ${data.completed_at ? String(data.completed_at) : new Date().toISOString()}, ${String(data.status)},
      ${data.notes ? String(data.notes) : null})
    RETURNING id
  `
  const rows = await db`
    SELECT cl.*, cc.name AS checklist_name FROM compliance_logs cl
    INNER JOIN compliance_checklists cc ON cc.id = cl.checklist_id
    WHERE cl.id = ${row.id}
  `
  return rows[0]
}

export async function auditLogs(limit = 100) {
  const lim = Math.max(1, Math.min(limit, 500))
  return unsafe(
    `SELECT al.*, u.email AS user_email FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ORDER BY al.created_at DESC LIMIT ${lim}`,
  )
}

/** Attendance + correction audit trail for HR review. */
export async function attendanceAuditLogs(limit = 100, action?: string | null) {
  const parsed = Number(limit)
  const lim = Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 500)) : 100
  const params: SqlValue[] = []
  let sql = `SELECT al.*, u.email AS user_email,
      e.first_name AS actor_first_name,
      e.last_name AS actor_last_name
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    LEFT JOIN employees e ON e.id = u.employee_id
    WHERE (
      al.table_name IN ('attendance', 'attendance_correction_requests')
      OR al.action LIKE 'attendance_%'
    )`
  if (action && action !== 'all') {
    params.push(action)
    sql += ` AND al.action = $${params.length}`
  }
  sql += ` ORDER BY al.created_at DESC LIMIT ${lim}`
  return unsafe(sql, params)
}

const CHECKLIST_TYPES = new Set(['food_safety', 'labor', 'fire_safety', 'health_permit'])
const FREQUENCIES = new Set(['daily', 'weekly', 'monthly', 'annual'])

export async function createChecklist(data: Record<string, unknown>) {
  const name = String(data.name ?? '').trim()
  if (!name) throw new ValidationError('name is required')
  const type = String(data.checklist_type ?? 'labor')
  if (!CHECKLIST_TYPES.has(type)) throw new ValidationError('Invalid checklist_type')
  const frequency = String(data.frequency ?? 'monthly')
  if (!FREQUENCIES.has(frequency)) throw new ValidationError('Invalid frequency')
  const db = getDb()
  const [row] = await db`
    INSERT INTO compliance_checklists (name, checklist_type, frequency, due_day)
    VALUES (${name}, ${type}, ${frequency},
      ${data.due_day != null && data.due_day !== '' ? Number(data.due_day) : null})
    RETURNING id
  `
  const rows = await db`SELECT * FROM compliance_checklists WHERE id = ${row.id}`
  return rows[0]
}

export async function updateChecklist(id: string, data: Record<string, unknown>) {
  const db = getDb()
  const existing = await db`SELECT id FROM compliance_checklists WHERE id = ${id} LIMIT 1`
  if (!existing[0]) return null
  const updates: Record<string, unknown> = {}
  if (data.name && String(data.name).trim()) updates.name = String(data.name).trim()
  if (data.checklist_type) updates.checklist_type = String(data.checklist_type)
  if (data.frequency) updates.frequency = String(data.frequency)
  if ('due_day' in data) {
    updates.due_day = data.due_day != null && data.due_day !== '' ? Number(data.due_day) : null
  }
  if (Object.keys(updates).length > 0) {
    const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ')
    await unsafeExec(`UPDATE compliance_checklists SET ${sets} WHERE id = $1`, [id, ...Object.values(updates) as SqlValue[]])
  }
  const rows = await db`SELECT * FROM compliance_checklists WHERE id = ${id}`
  return rows[0] ?? null
}

export async function deleteChecklist(id: string): Promise<boolean> {
  const count = await unsafeExec(`DELETE FROM compliance_checklists WHERE id = $1`, [id])
  return count > 0
}
