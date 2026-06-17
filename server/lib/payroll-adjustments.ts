import { getDb } from './db'
import { ValidationError } from './errors'
import { unsafe, type SqlValue } from './sql'

const ALLOWED_TYPES = new Set(['bonus', 'advance', 'loan_repay', 'penalty', 'allowance', 'meal', 'transport'])

export async function listAdjustments(
  employeeId?: string | null,
  runId?: string | null,
  recurringOnly?: boolean | null,
) {
  const params: SqlValue[] = []
  let sql = `SELECT pa.*, e.emp_number, e.first_name, e.last_name
    FROM payroll_adjustments pa
    INNER JOIN employees e ON e.id = pa.employee_id WHERE 1=1`
  if (employeeId) {
    params.push(employeeId)
    sql += ` AND pa.employee_id = $${params.length}`
  }
  if (runId) {
    params.push(runId)
    sql += ` AND pa.payroll_run_id = $${params.length}`
  }
  if (recurringOnly) sql += ' AND pa.payroll_run_id IS NULL'
  sql += ' ORDER BY pa.created_at DESC'
  return unsafe(sql, params)
}

export async function createAdjustment(data: Record<string, unknown>, userId: string) {
  const amount = Math.round(Number(data.amount ?? 0) * 100) / 100
  if (amount === 0) throw new ValidationError('amount required')
  const type = String(data.adj_type ?? 'allowance')
  if (!ALLOWED_TYPES.has(type)) throw new ValidationError('Invalid adj_type')
  const db = getDb()
  const [row] = await db`
    INSERT INTO payroll_adjustments (employee_id, payroll_run_id, adj_type, amount, description, approved_by)
    VALUES (${String(data.employee_id)}, ${data.payroll_run_id ? String(data.payroll_run_id) : null},
      ${type}, ${amount}, ${data.description ? String(data.description) : null}, ${userId})
    RETURNING id
  `
  const rows = await db`SELECT * FROM payroll_adjustments WHERE id = ${row.id}`
  return rows[0]
}

export async function deleteAdjustment(id: string): Promise<boolean> {
  const db = getDb()
  const result = await db`DELETE FROM payroll_adjustments WHERE id = ${id}`
  return result.count > 0
}

export async function totalsForEmployee(employeeId: string, runId: string) {
  const db = getDb()
  const recurring = await db`
    SELECT adj_type, SUM(amount) AS total FROM payroll_adjustments
    WHERE employee_id = ${employeeId} AND payroll_run_id IS NULL
    GROUP BY adj_type
  `
  const runSpecific = await db`
    SELECT adj_type, SUM(amount) AS total FROM payroll_adjustments
    WHERE employee_id = ${employeeId} AND payroll_run_id = ${runId}
    GROUP BY adj_type
  `
  let credits = 0
  let debits = 0
  const creditTypes = new Set(['bonus', 'allowance', 'meal', 'transport'])
  const debitTypes = new Set(['advance', 'loan_repay', 'penalty'])
  for (const row of [...recurring, ...runSpecific]) {
    const amt = Number(row.total)
    if (creditTypes.has(String(row.adj_type))) credits += amt
    else if (debitTypes.has(String(row.adj_type))) debits += amt
  }
  return { credits: Math.round(credits * 100) / 100, debits: Math.round(debits * 100) / 100, net: Math.round((credits - debits) * 100) / 100 }
}
