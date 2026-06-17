import { getDb, nullableInt } from './db'
import { unsafe, unsafeExec, type SqlValue } from './sql'

const BRANCH_COLS = 'id, name, address, phone, timezone, is_active, manager_id, created_at, default_latitude, default_longitude'

export async function listBranches() {
  const db = getDb()
  return unsafe(`SELECT ${BRANCH_COLS} FROM branches ORDER BY name`)
}

export async function getBranch(id: string) {
  const rows = await unsafe(`SELECT ${BRANCH_COLS} FROM branches WHERE id = $1 LIMIT 1`, [id])
  return rows[0] ?? null
}

export async function createBranch(data: Record<string, unknown>) {
  const db = getDb()
  const [row] = await db`
    INSERT INTO branches (name, address, phone, timezone, is_active, manager_id)
    VALUES (
      ${String(data.name)}, ${nullableStr(data.address)}, ${nullableStr(data.phone)},
      ${String(data.timezone ?? 'Asia/Manila')},
      ${data.is_active != null ? Boolean(data.is_active) : true},
      ${nullableInt(data.manager_id)}
    )
    RETURNING id
  `
  return (await getBranch(String(row.id)))!
}

export async function updateBranch(id: string, data: Record<string, unknown>) {
  const fields = ['name', 'address', 'phone', 'timezone', 'manager_id', 'default_latitude', 'default_longitude'] as const
  const updates: Record<string, unknown> = {}
  for (const f of fields) {
    if (f in data) updates[f] = data[f]
  }
  if ('is_active' in data) updates.is_active = Boolean(data.is_active)
  if (Object.keys(updates).length === 0) return getBranch(id)

  const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ')
  const params: SqlValue[] = [id, ...(Object.values(updates) as SqlValue[])]
  await unsafeExec(`UPDATE branches SET ${sets} WHERE id = $1`, params)
  return getBranch(id)
}

export async function listDepartments(branchId?: string | null) {
  const db = getDb()
  const sql = `SELECT d.id, d.branch_id, d.name, d.cost_center, d.head_id, b.name AS branch_name
               FROM departments d INNER JOIN branches b ON b.id = d.branch_id`
  if (branchId) {
    return unsafe(`${sql} WHERE d.branch_id = $1 ORDER BY b.name, d.name`, [branchId])
  }
  return unsafe(`${sql} ORDER BY b.name, d.name`)
}

export async function createDepartment(data: Record<string, unknown>) {
  const db = getDb()
  const [row] = await db`
    INSERT INTO departments (branch_id, name, cost_center, head_id)
    VALUES (${String(data.branch_id)}, ${String(data.name)}, ${nullableStr(data.cost_center)}, ${nullableInt(data.head_id)})
    RETURNING id
  `
  const rows = await db`
    SELECT d.*, b.name AS branch_name FROM departments d
    INNER JOIN branches b ON b.id = d.branch_id WHERE d.id = ${row.id}
  `
  return rows[0]
}

export async function updateDepartment(id: string, data: Record<string, unknown>) {
  const fields = ['name', 'cost_center', 'head_id', 'branch_id'] as const
  const updates: Record<string, unknown> = {}
  for (const f of fields) {
    if (f in data) updates[f] = data[f]
  }
  if (Object.keys(updates).length === 0) return null

  const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ')
  const params: SqlValue[] = [id, ...(Object.values(updates) as SqlValue[])]
  await unsafeExec(`UPDATE departments SET ${sets} WHERE id = $1`, params)
  const db = getDb()
  const rows = await db`
    SELECT d.*, b.name AS branch_name FROM departments d
    INNER JOIN branches b ON b.id = d.branch_id WHERE d.id = ${id}
  `
  return rows[0] ?? null
}

export async function listPositions(departmentId?: string | null, branchId?: string | null) {
  const db = getDb()
  let sql = `SELECT p.id, p.department_id, p.title, p.pay_grade, p.min_hourly, p.max_hourly, p.is_tipped,
                    d.name AS department_name, d.branch_id, b.name AS branch_name
             FROM positions p
             INNER JOIN departments d ON d.id = p.department_id
             INNER JOIN branches b ON b.id = d.branch_id WHERE 1=1`
  const params: string[] = []
  if (departmentId) {
    params.push(departmentId)
    sql += ` AND p.department_id = $${params.length}`
  }
  if (branchId) {
    params.push(branchId)
    sql += ` AND d.branch_id = $${params.length}`
  }
  sql += ' ORDER BY b.name, d.name, p.title'
  return unsafe(sql, params)
}

export async function getPosition(id: string) {
  const db = getDb()
  const rows = await db`
    SELECT p.id, p.department_id, p.title, p.pay_grade, p.min_hourly, p.max_hourly, p.is_tipped,
           d.name AS department_name, d.branch_id, b.name AS branch_name
    FROM positions p
    INNER JOIN departments d ON d.id = p.department_id
    INNER JOIN branches b ON b.id = d.branch_id
    WHERE p.id = ${id}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function createPosition(data: Record<string, unknown>) {
  const db = getDb()
  const [row] = await db`
    INSERT INTO positions (department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
    VALUES (
      ${String(data.department_id)}, ${String(data.title)},
      ${data.pay_grade != null ? Number(data.pay_grade) : null},
      ${data.min_hourly != null ? Number(data.min_hourly) : null},
      ${data.max_hourly != null ? Number(data.max_hourly) : null},
      ${Boolean(data.is_tipped)}
    )
    RETURNING id
  `
  return (await getPosition(String(row.id)))!
}

export async function updatePosition(id: string, data: Record<string, unknown>) {
  const map: Record<string, string> = {
    department_id: 'department_id',
    title: 'title',
    pay_grade: 'pay_grade',
    min_hourly: 'min_hourly',
    max_hourly: 'max_hourly',
  }
  const updates: Record<string, unknown> = {}
  for (const [key, col] of Object.entries(map)) {
    if (key in data) updates[col] = data[key]
  }
  if ('is_tipped' in data) updates.is_tipped = Boolean(data.is_tipped)
  if (Object.keys(updates).length === 0) return getPosition(id)

  const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ')
  const params: SqlValue[] = [id, ...(Object.values(updates) as SqlValue[])]
  await unsafeExec(`UPDATE positions SET ${sets} WHERE id = $1`, params)
  return getPosition(id)
}

function nullableStr(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s === '' ? null : s
}
