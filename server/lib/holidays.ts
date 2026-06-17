import { getDb } from './db'
import { unsafe, unsafeExec, type SqlValue } from './sql'

export async function list(branchId?: string | null, year?: number | null) {
  const params: SqlValue[] = []
  let sql = `SELECT h.*, b.name AS branch_name FROM holidays h
    LEFT JOIN branches b ON b.id = h.branch_id WHERE 1=1`
  if (branchId) {
    params.push(branchId)
    sql += ` AND (h.branch_id = $${params.length} OR h.branch_id IS NULL)`
  }
  if (year) {
    params.push(year)
    sql += ` AND EXTRACT(YEAR FROM h.holiday_date) = $${params.length}`
  }
  sql += ' ORDER BY h.holiday_date'
  return unsafe(sql, params)
}

export async function get(id: string) {
  const db = getDb()
  const rows = await db`SELECT * FROM holidays WHERE id = ${id} LIMIT 1`
  return rows[0] ?? null
}

export async function create(data: Record<string, unknown>) {
  const db = getDb()
  const [row] = await db`
    INSERT INTO holidays (branch_id, holiday_date, name, holiday_type, pay_multiplier)
    VALUES (${data.branch_id ? String(data.branch_id) : null}, ${String(data.holiday_date)},
      ${String(data.name)}, ${String(data.holiday_type ?? 'national')}, ${Number(data.pay_multiplier ?? 1.3)})
    RETURNING id
  `
  return get(String(row.id))
}

export async function update(id: string, data: Record<string, unknown>) {
  if (!(await get(id))) return null
  const fields = ['branch_id', 'holiday_date', 'name', 'holiday_type', 'pay_multiplier']
  const updates: Record<string, unknown> = {}
  for (const f of fields) if (f in data) updates[f] = data[f]
  if (Object.keys(updates).length === 0) return get(id)
  const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ')
  await unsafeExec(`UPDATE holidays SET ${sets} WHERE id = $1`, [id, ...Object.values(updates) as SqlValue[]])
  return get(id)
}

export async function deleteHoliday(id: string): Promise<boolean> {
  const count = await unsafeExec(`DELETE FROM holidays WHERE id = $1`, [id])
  return count > 0
}

export async function holidayHoursInPeriod(
  employeeId: string,
  from: string,
  to: string,
  branchId?: string | null,
): Promise<number> {
  const params: SqlValue[] = [employeeId, from, to]
  let sql = `SELECT COALESCE(SUM(a.actual_hours), 0) AS h FROM attendance a
    WHERE a.employee_id = $1 AND DATE(a.clock_in) BETWEEN $2 AND $3
    AND EXISTS (SELECT 1 FROM holidays h WHERE h.holiday_date = DATE(a.clock_in)`
  if (branchId) {
    params.push(branchId)
    sql += ` AND (h.branch_id IS NULL OR h.branch_id = $${params.length})`
  } else {
    sql += ' AND h.branch_id IS NULL'
  }
  sql += ')'
  const rows = await unsafe<{ h: string }>(sql, params)
  return Math.round(Number(rows[0]?.h ?? 0) * 100) / 100
}

export async function holidayPremiumPay(
  employeeId: string,
  from: string,
  to: string,
  branchId: string | null,
  hourly: number,
): Promise<number> {
  const params: SqlValue[] = [employeeId, from, to, branchId ?? '']
  const rows = await unsafe<{ actual_hours: string; pay_multiplier: string }>(
    `SELECT a.actual_hours, h.pay_multiplier FROM attendance a
     INNER JOIN holidays h ON h.holiday_date = DATE(a.clock_in)
       AND (h.branch_id IS NULL OR h.branch_id = $4)
     WHERE a.employee_id = $1 AND DATE(a.clock_in) BETWEEN $2 AND $3`,
    params,
  )
  let premium = 0
  for (const row of rows) {
    const hrs = Number(row.actual_hours)
    const mult = Number(row.pay_multiplier)
    premium += hrs * hourly * Math.max(0, mult - 1)
  }
  return Math.round(premium * 100) / 100
}
