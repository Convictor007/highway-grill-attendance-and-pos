import { getDb } from './db'
import { ValidationError } from './errors'
import { unsafe, type SqlValue } from './sql'

export async function listPools(branchId?: string | null, limit = 50) {
  const lim = Math.max(1, Math.min(limit, 100))
  const params: SqlValue[] = []
  let sql = `SELECT tp.*, b.name AS branch_name FROM tips_pool tp
    INNER JOIN branches b ON b.id = tp.branch_id WHERE 1=1`
  if (branchId) {
    params.push(branchId)
    sql += ` AND tp.branch_id = $${params.length}`
  }
  sql += ` ORDER BY tp.pool_date DESC LIMIT ${lim}`
  return unsafe(sql, params)
}

export async function getPool(id: string) {
  const db = getDb()
  const rows = await db`
    SELECT tp.*, b.name AS branch_name FROM tips_pool tp
    INNER JOIN branches b ON b.id = tp.branch_id WHERE tp.id = ${id} LIMIT 1
  `
  return rows[0] ?? null
}

export async function createPool(data: Record<string, unknown>) {
  const db = getDb()
  const [row] = await db`
    INSERT INTO tips_pool (branch_id, pool_date, total_tips, shift_type, status)
    VALUES (${String(data.branch_id)}, ${String(data.pool_date)}, ${Number(data.total_tips)},
      ${String(data.shift_type ?? 'all_day')}, 'pending')
    RETURNING id
  `
  return getPool(String(row.id))
}

export async function distributions(poolId: string) {
  const db = getDb()
  return db`
    SELECT td.*, e.first_name, e.last_name, e.emp_number
    FROM tips_distribution td
    INNER JOIN employees e ON e.id = td.employee_id
    WHERE td.tips_pool_id = ${poolId}
  `
}

export async function distribute(poolId: string, allocations: Record<string, unknown>[]) {
  const pool = await getPool(poolId)
  if (!pool || String(pool.status) !== 'pending') {
    throw new ValidationError('Tips pool not found or already distributed')
  }
  const total = Number(pool.total_tips)
  const db = getDb()
  await db.begin(async (tx) => {
    await tx`DELETE FROM tips_distribution WHERE tips_pool_id = ${poolId}`
    for (const row of allocations) {
      const pct = Number(row.percentage)
      const amt = Math.round(total * (pct / 100) * 100) / 100
      await tx`
        INSERT INTO tips_distribution (tips_pool_id, employee_id, percentage, amount)
        VALUES (${poolId}, ${String(row.employee_id)}, ${pct}, ${amt})
      `
    }
    await tx`UPDATE tips_pool SET status = 'distributed' WHERE id = ${poolId}`
  })
  return distributions(poolId)
}

export async function distributeEqualAmongTipped(poolId: string) {
  const pool = await getPool(poolId)
  if (!pool) throw new ValidationError('Tips pool not found')
  const db = getDb()
  const employees = await db`
    SELECT e.id FROM employees e
    INNER JOIN positions p ON p.id = e.position_id
    WHERE e.branch_id = ${String(pool.branch_id)} AND e.status = 'active' AND p.is_tipped = true
    ORDER BY e.last_name, e.first_name
  `
  if (employees.length === 0) throw new ValidationError('No tipped employees in this branch')
  const count = employees.length
  const pctEach = Math.round((100 / count) * 10000) / 10000
  const allocations = employees.map((emp, i) => ({
    employee_id: String(emp.id),
    percentage: i === count - 1 ? Math.round((100 - pctEach * (count - 1)) * 10000) / 10000 : pctEach,
  }))
  return distribute(poolId, allocations)
}
