import { getDb, nullableInt } from './db'
import { hashPassword } from './auth'
import { validatePositionForBranch } from './employees'

export async function registerOptions(branchId?: string | null) {
  const db = getDb()
  const branches = await db`
    SELECT id, name FROM branches WHERE is_active = true ORDER BY name
  `

  let departments: Record<string, unknown>[] = []
  let positions: Record<string, unknown>[] = []

  if (branchId) {
    departments = await db`
      SELECT id, branch_id, name FROM departments
      WHERE branch_id = ${branchId}
      ORDER BY name
    `
    positions = await db`
      SELECT p.id, p.department_id, p.title, p.pay_grade, p.is_tipped, d.name AS department_name
      FROM positions p
      INNER JOIN departments d ON d.id = p.department_id
      WHERE d.branch_id = ${branchId}
      ORDER BY d.name, p.title
    `
  }

  return { branches, departments, positions }
}

export async function register(data: Record<string, unknown>) {
  const email = String(data.email ?? '').trim().toLowerCase()
  const password = String(data.password ?? '')
  const firstName = String(data.first_name ?? '').trim()
  const lastName = String(data.last_name ?? '').trim()
  const branchId = String(data.branch_id ?? '').trim()
  const phone = String(data.phone ?? '').trim()

  if (!email || !password || !firstName || !lastName || !branchId) {
    throw new Error('email, password, first_name, last_name, and branch_id are required')
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters')
  }

  const db = getDb()
  const [branch] = await db`
    SELECT id, name FROM branches WHERE id = ${branchId} AND is_active = true LIMIT 1
  `
  if (!branch) throw new Error('Invalid branch')

  await validatePositionForBranch(
    branchId,
    data.department_id != null && data.department_id !== '' ? String(data.department_id) : null,
    data.position_id != null && data.position_id !== '' ? String(data.position_id) : null,
  )

  const [existingUser] = await db`SELECT id FROM users WHERE email = ${email} LIMIT 1`
  if (existingUser) throw new Error('Email already registered')

  const [existingEmp] = await db`SELECT id FROM employees WHERE email = ${email} LIMIT 1`
  if (existingEmp) throw new Error('Email already used on an employee record')

  const [role] = await db`SELECT role_id FROM roles WHERE role_slug = 'employee' LIMIT 1`
  if (!role) throw new Error('Employee role not configured')

  const empNumber = await nextEmpNumber()

  let employmentType = String(data.employment_type ?? 'full_time')
  if (!['full_time', 'part_time', 'casual', 'seasonal'].includes(employmentType)) {
    employmentType = 'full_time'
  }

  const gender: string | null = data.gender != null && data.gender !== '' ? String(data.gender) : null
  if (gender && !['male', 'female', 'other', 'prefer_not'].includes(gender)) {
    throw new Error('Invalid gender')
  }

  const dob = String(data.date_of_birth ?? '').trim()
  if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    throw new Error('date_of_birth must be YYYY-MM-DD')
  }

  await db.begin(async (tx) => {
    const [emp] = await tx`
      INSERT INTO employees (
        branch_id, department_id, position_id, emp_number, first_name, last_name,
        email, phone, hire_date, employment_type, status, date_of_birth, gender, nationality,
        address, emergency_name, emergency_phone, is_stay_in
      ) VALUES (
        ${nullableInt(branchId)}, ${nullableInt(data.department_id)}, ${nullableInt(data.position_id)},
        ${empNumber}, ${firstName}, ${lastName},
        ${email}, ${phone || null}, CURRENT_DATE, ${employmentType}, 'pending', ${dob || null}, ${gender},
        ${String(data.nationality ?? '').trim() || 'Filipino'},
        ${String(data.address ?? '').trim() || null},
        ${String(data.emergency_name ?? '').trim() || null},
        ${String(data.emergency_phone ?? '').trim() || null},
        ${Boolean(data.is_stay_in)}
      )
      RETURNING id
    `
    await tx`
      INSERT INTO users (email, password_hash, role_id, employee_id, is_active, account_status)
      VALUES (${email}, ${hashPassword(password)}, ${role.role_id}, ${emp.id}, false, 'awaiting_hr')
    `
  })

  return {
    message:
      'Registration submitted. HR will review your application and notify you by email when you can sign in.',
    emp_number: empNumber,
    account_status: 'awaiting_hr',
  }
}

async function nextEmpNumber(): Promise<string> {
  const db = getDb()
  const rows = await db<{ emp_number: string }[]>`
    SELECT emp_number FROM employees
    WHERE emp_number ~ '^HG-[0-9]+$'
    ORDER BY (SUBSTRING(emp_number FROM 4))::integer DESC
    LIMIT 1
  `
  let n = 200
  const last = rows[0]?.emp_number
  if (last) {
    const m = /^HG-(\d+)$/.exec(last)
    if (m) n = Number.parseInt(m[1], 10) + 1
  }
  return `HG-${n}`
}
