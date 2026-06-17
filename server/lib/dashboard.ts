import { getDb } from './db'
import { unsafe, type SqlValue } from './sql'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export async function summary(branchId?: string | null) {
  const today = todayIso()
  const monthStart = `${today.slice(0, 8)}01`
  const db = getDb()

  const empParams: SqlValue[] = []
  let empSql = `SELECT COUNT(*)::int AS c FROM employees WHERE status = 'active'`
  if (branchId) {
    empParams.push(branchId)
    empSql += ` AND branch_id = $${empParams.length}`
  }
  const empRows = await unsafe<{ c: number }>(empSql, empParams)
  const activeEmployees = empRows[0]?.c ?? 0

  const attParams: SqlValue[] = [today]
  let attSql = `SELECT COUNT(DISTINCT a.employee_id)::int AS c FROM attendance a
    INNER JOIN employees e ON e.id = a.employee_id WHERE DATE(a.clock_in) = $1`
  if (branchId) {
    attParams.push(branchId)
    attSql += ` AND e.branch_id = $${attParams.length}`
  }
  const attRows = await unsafe<{ c: number }>(attSql, attParams)
  const presentToday = attRows[0]?.c ?? 0

  const openParams: SqlValue[] = []
  let openSql = `SELECT COUNT(*)::int AS c FROM attendance a
    INNER JOIN employees e ON e.id = a.employee_id WHERE a.clock_out IS NULL`
  if (branchId) {
    openParams.push(branchId)
    openSql += ` AND e.branch_id = $${openParams.length}`
  }
  const openRows = await unsafe<{ c: number }>(openSql, openParams)
  const stillClockedIn = openRows[0]?.c ?? 0

  const leaveRows = await db`SELECT COUNT(*)::int AS c FROM leave_requests WHERE status = 'pending'`
  const pendingLeave = Number(leaveRows[0]?.c ?? 0)

  const draftParams: SqlValue[] = []
  let draftSql = `SELECT COUNT(*)::int AS c FROM payroll_runs WHERE status = 'draft'`
  if (branchId) {
    draftParams.push(branchId)
    draftSql += ` AND branch_id = $${draftParams.length}`
  }
  const draftRows = await unsafe<{ c: number }>(draftSql, draftParams)
  const draftPayroll = draftRows[0]?.c ?? 0

  const hrsParams: SqlValue[] = [monthStart, today]
  let hrsSql = `SELECT COALESCE(SUM(a.actual_hours), 0) AS h FROM attendance a
    INNER JOIN employees e ON e.id = a.employee_id
    WHERE DATE(a.clock_in) BETWEEN $1 AND $2`
  if (branchId) {
    hrsParams.push(branchId)
    hrsSql += ` AND e.branch_id = $${hrsParams.length}`
  }
  const hrsRows = await unsafe<{ h: string }>(hrsSql, hrsParams)
  const monthHours = Math.round(Number(hrsRows[0]?.h ?? 0) * 10) / 10

  let pendingLoans = 0
  try {
    const loanRows = await db`SELECT COUNT(*)::int AS c FROM employee_loans WHERE status = 'pending'`
    pendingLoans = Number(loanRows[0]?.c ?? 0)
  } catch {
    pendingLoans = 0
  }

  return {
    date: today,
    active_employees: activeEmployees,
    present_today: presentToday,
    still_clocked_in: stillClockedIn,
    pending_leave: pendingLeave,
    draft_payroll_runs: draftPayroll,
    month_hours: monthHours,
    pending_loans: pendingLoans,
    attendance_rate_today: activeEmployees > 0 ? Math.round((presentToday / activeEmployees) * 1000) / 10 : 0,
  }
}

export async function orgMasterlist(branchId?: string | null) {
  const params: SqlValue[] = []
  let sql = `SELECT e.id, e.emp_number, e.first_name, e.last_name, e.email, e.phone,
    e.hire_date, e.employment_type, e.status,
    b.name AS branch_name, d.name AS department_name, p.title AS position_title
    FROM employees e
    LEFT JOIN branches b ON b.id = e.branch_id
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN positions p ON p.id = e.position_id
    WHERE e.status IN ('active', 'on_leave')`
  if (branchId) {
    params.push(branchId)
    sql += ` AND e.branch_id = $${params.length}`
  }
  sql += ' ORDER BY b.name, d.name, e.last_name, e.first_name'
  return unsafe(sql, params)
}
