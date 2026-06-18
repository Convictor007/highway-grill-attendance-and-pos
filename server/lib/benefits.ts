import { getDb } from './db'
import { unsafe, unsafeExec, type SqlValue } from './sql'

export async function list(employeeId?: string | null) {
  const params: SqlValue[] = []
  let sql = `SELECT be.*, e.emp_number, e.first_name, e.last_name
    FROM employee_benefit_enrollments be
    INNER JOIN employees e ON e.id = be.employee_id WHERE 1=1`
  if (employeeId) {
    params.push(employeeId)
    sql += ` AND be.employee_id = $${params.length}`
  }
  sql += ' ORDER BY e.last_name, be.benefit_name'
  return unsafe(sql, params)
}

export async function create(data: Record<string, unknown>) {
  const db = getDb()
  const [row] = await db`
    INSERT INTO employee_benefit_enrollments (employee_id, benefit_code, benefit_name, amount, frequency, is_active, notes)
    VALUES (${String(data.employee_id)}, ${String(data.benefit_code ?? 'allowance')},
      ${String(data.benefit_name)}, ${Number(data.amount ?? 0)}, ${String(data.frequency ?? 'monthly')},
      ${data.is_active !== false}, ${data.notes ? String(data.notes) : null})
    RETURNING id
  `
  const rows = await db`SELECT * FROM employee_benefit_enrollments WHERE id = ${row.id}`
  return rows[0]
}

export async function update(id: string, data: Record<string, unknown>) {
  const db = getDb()
  const fields = ['benefit_name', 'amount', 'frequency', 'notes']
  const updates: Record<string, unknown> = {}
  for (const f of fields) if (f in data) updates[f] = data[f]
  if ('is_active' in data) updates.is_active = Boolean(data.is_active)
  if (Object.keys(updates).length === 0) return null
  const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ')
  await unsafeExec(`UPDATE employee_benefit_enrollments SET ${sets} WHERE id = $1`, [id, ...Object.values(updates) as SqlValue[]])
  const rows = await db`SELECT * FROM employee_benefit_enrollments WHERE id = ${id}`
  return rows[0] ?? null
}

export async function remove(id: string) {
  const count = await unsafeExec(`DELETE FROM employee_benefit_enrollments WHERE id = $1`, [id])
  return count > 0
}

export async function periodTotalForEmployee(employeeId: string, payFrequency = 'semi_monthly'): Promise<number> {
  const db = getDb()
  const rows = await db`
    SELECT amount, frequency FROM employee_benefit_enrollments
    WHERE employee_id = ${employeeId} AND is_active = true
  `
  let total = 0
  for (const row of rows) {
    const amt = Number(row.amount)
    if (String(row.frequency) === 'per_payroll') {
      total += amt
      continue
    }
    total += payFrequency === 'monthly' ? amt : amt / 2
  }
  return Math.round(total * 100) / 100
}
