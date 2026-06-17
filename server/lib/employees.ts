import { getDb, nullableInt } from './db'
import { unsafe, unsafeExec, type SqlValue } from './sql'
import { ValidationError } from './errors'
import { ensureBalancesForEmployee } from './leave'

const EMPLOYEE_SELECT = `
  SELECT e.*, b.name AS branch_name, d.name AS department_name, p.title AS position_title,
         p.min_hourly AS position_min_hourly
  FROM employees e
  LEFT JOIN branches b ON b.id = e.branch_id
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN positions p ON p.id = e.position_id
`

/** Crew-facing lists exclude system admin login accounts. */
const EXCLUDE_SYSTEM_ADMIN = `
  AND NOT EXISTS (
    SELECT 1 FROM users u
    INNER JOIN roles r ON r.role_id = u.role_id
    WHERE u.employee_id = e.id AND r.role_slug = 'admin'
  )
`

export async function listEmployees(branchId?: string | null, status?: string | null) {
  if (branchId && status) {
    return unsafe(`${EMPLOYEE_SELECT} WHERE e.branch_id = $1 AND e.status = $2${EXCLUDE_SYSTEM_ADMIN} ORDER BY e.last_name, e.first_name`, [branchId, status])
  }
  if (branchId) {
    return unsafe(`${EMPLOYEE_SELECT} WHERE e.branch_id = $1${EXCLUDE_SYSTEM_ADMIN} ORDER BY e.last_name, e.first_name`, [branchId])
  }
  if (status) {
    return unsafe(`${EMPLOYEE_SELECT} WHERE e.status = $1${EXCLUDE_SYSTEM_ADMIN} ORDER BY e.last_name, e.first_name`, [status])
  }
  return unsafe(`${EMPLOYEE_SELECT} WHERE 1=1${EXCLUDE_SYSTEM_ADMIN} ORDER BY e.last_name, e.first_name`)
}

export async function getEmployee(id: string) {
  const db = getDb()
  const rows = await unsafe(`${EMPLOYEE_SELECT} WHERE e.id = $1 LIMIT 1`, [id])
  return rows[0] ?? null
}

export async function validatePositionForBranch(
  branchId: string,
  departmentId?: string | null,
  positionId?: string | null,
) {
  if (!positionId) return
  const db = getDb()
  const rows = await db`
    SELECT d.branch_id FROM positions p
    INNER JOIN departments d ON d.id = p.department_id
    WHERE p.id = ${positionId}
    LIMIT 1
  `
  if (!rows[0] || String(rows[0].branch_id) !== branchId) {
    throw new ValidationError('Invalid position for branch')
  }
  if (departmentId) {
    const check = await db`
      SELECT id FROM positions WHERE id = ${positionId} AND department_id = ${departmentId} LIMIT 1
    `
    if (!check[0]) throw new ValidationError('Position does not match department')
  }
}

export async function createEmployee(data: Record<string, unknown>) {
  const db = getDb()
  const status = String(data.status ?? 'active')
  const [row] = await db`
    INSERT INTO employees (
      branch_id, department_id, position_id, emp_number, first_name, last_name,
      email, phone, hire_date, employment_type, pay_basis, pay_rate, is_stay_in, housing_deduction,
      status, date_of_birth, gender, nationality, national_id, address, emergency_name, emergency_phone, photo_url
    ) VALUES (
      ${nullableInt(data.branch_id)}, ${nullableInt(data.department_id)}, ${nullableInt(data.position_id)},
      ${String(data.emp_number)}, ${String(data.first_name)}, ${String(data.last_name)},
      ${nullableStr(data.email)}, ${nullableStr(data.phone)},
      ${String(data.hire_date ?? new Date().toISOString().slice(0, 10))},
      ${normalizeEmploymentType(String(data.employment_type ?? 'full_time'))},
      ${normalizePayBasis(String(data.pay_basis ?? 'hourly'))},
      ${nullablePayRate(data.pay_rate)},
      ${Boolean(data.is_stay_in)},
      ${housingDeduction(data.is_stay_in, data.housing_deduction)},
      ${status},
      ${nullableDate(data.date_of_birth)},
      ${normalizeGender(data.gender)},
      ${nullableStr(data.nationality)},
      ${nullableStr(data.national_id)},
      ${nullableStr(data.address)},
      ${nullableStr(data.emergency_name)},
      ${nullableStr(data.emergency_phone)},
      ${nullableStr(data.photo_url)}
    )
    RETURNING id
  `
  const id = String(row.id)
  if (status === 'active') {
    await ensureBalancesForEmployee(id, new Date().getFullYear())
  }
  return (await getEmployee(id))!
}

export async function updateEmployee(id: string, data: Record<string, unknown>) {
  const existing = await getEmployee(id)
  if (!existing) return null

  const fields = [
    'first_name', 'last_name', 'email', 'phone', 'branch_id', 'department_id', 'position_id',
    'employment_type', 'status', 'address', 'date_of_birth', 'gender', 'nationality', 'national_id',
    'emergency_name', 'emergency_phone', 'photo_url', 'hire_date', 'pay_basis', 'pay_rate',
    'is_stay_in', 'housing_deduction',
  ] as const

  const updates: Record<string, unknown> = {}
  for (const f of fields) {
    if (!(f in data)) continue
    let val = data[f]
    if (f === 'date_of_birth') val = nullableDate(val)
    else if (f === 'gender') val = normalizeGender(val)
    else if (f === 'employment_type') val = normalizeEmploymentType(String(val))
    else if (f === 'pay_basis') val = normalizePayBasis(String(val))
    else if (f === 'pay_rate') val = nullablePayRate(val)
    else if (f === 'is_stay_in') val = Boolean(val)
    else if (f === 'housing_deduction') {
      const stayIn = 'is_stay_in' in data ? Boolean(data.is_stay_in) : Boolean(existing.is_stay_in)
      val = housingDeduction(stayIn, val)
    } else if (f === 'department_id' || f === 'position_id') {
      val = nullableInt(val)
    } else if (['address', 'nationality', 'national_id', 'emergency_name', 'emergency_phone', 'photo_url', 'email', 'phone'].includes(f)) {
      val = nullableStr(val)
    }
    updates[f] = val
  }

  if (Object.keys(updates).length === 0) return existing

  const db = getDb()
  const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ')
  const values: SqlValue[] = [id, ...Object.values(updates) as SqlValue[]]
  await unsafeExec(`UPDATE employees SET ${sets} WHERE id = $1`, values)
  return getEmployee(id)
}

export async function updateEmployeeSelf(id: string, data: Record<string, unknown>) {
  const allowed = ['phone', 'email', 'address', 'emergency_name', 'emergency_phone', 'date_of_birth', 'gender', 'nationality'] as const
  const filtered: Record<string, unknown> = {}
  for (const f of allowed) {
    if (f in data) filtered[f] = data[f]
  }
  return updateEmployee(id, filtered)
}

export async function deleteEmployee(id: string) {
  const count = await unsafeExec(`UPDATE employees SET status = 'terminated' WHERE id = $1`, [id])
  return count > 0
}

export async function setEmployeePhotoUrl(employeeId: string, url: string) {
  const db = getDb()
  await db`UPDATE employees SET photo_url = ${url} WHERE id = ${employeeId}`
  return (await getEmployee(employeeId))!
}

function nullableStr(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s === '' ? null : s
}

function nullableDate(value: unknown): string | null {
  if (value == null || value === '') return null
  const s = String(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new ValidationError('date_of_birth must be YYYY-MM-DD')
  return s
}

function normalizeGender(value: unknown): string | null {
  if (value == null || value === '') return null
  const g = String(value)
  if (!['male', 'female', 'other', 'prefer_not'].includes(g)) throw new ValidationError('Invalid gender')
  return g
}

function normalizeEmploymentType(value: string): string {
  return ['full_time', 'part_time', 'casual', 'seasonal'].includes(value) ? value : 'full_time'
}

function normalizePayBasis(value: string): string {
  return value === 'daily' ? 'daily' : 'hourly'
}

function nullablePayRate(value: unknown): number | null {
  if (value == null || value === '') return null
  const rate = Math.round(Number(value) * 100) / 100
  return rate > 0 ? rate : null
}

function housingDeduction(stayIn: unknown, amount: unknown): number {
  if (!Boolean(stayIn)) return 0
  if (amount == null || amount === '') return 0
  return Math.max(0, Math.round(Number(amount) * 100) / 100)
}
