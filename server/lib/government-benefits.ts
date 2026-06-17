import { getDb } from './db'
import { list as listEnrollments } from './benefits'
import { monthlyEmployeeShares } from './payroll-ph-deductions'
import { unsafe } from './sql'

export type GovernmentAgency = 'sss' | 'philhealth' | 'pagibig'

const WORKING_DAYS_PER_MONTH = 26
const HOURS_PER_DAY = 8

export function estimateMonthlyCompensation(payBasis: string, rate: number) {
  if (payBasis === 'daily') return Math.round(rate * WORKING_DAYS_PER_MONTH * 100) / 100
  return Math.round(rate * HOURS_PER_DAY * WORKING_DAYS_PER_MONTH * 100) / 100
}

export async function getEmployeeCompensation(employeeId: string) {
  const rows = await unsafe<{
    pay_basis: string
    rate: string | number
    first_name: string
    last_name: string
    emp_number: string
  }>(
    `SELECT e.pay_basis, COALESCE(e.pay_rate, p.min_hourly, 80) AS rate,
      e.first_name, e.last_name, e.emp_number
     FROM employees e
     LEFT JOIN positions p ON p.id = e.position_id
     WHERE e.id = $1 LIMIT 1`,
    [employeeId],
  )
  const row = rows[0]
  if (!row) return null
  const rate = Number(row.rate)
  const monthly = estimateMonthlyCompensation(String(row.pay_basis), rate)
  return {
    pay_basis: String(row.pay_basis),
    pay_rate: rate,
    monthly_compensation: monthly,
    first_name: String(row.first_name),
    last_name: String(row.last_name),
    emp_number: String(row.emp_number),
  }
}

export async function getGovernmentProfile(employeeId: string) {
  const db = getDb()
  const rows = await db`
    SELECT * FROM employee_government_profiles WHERE employee_id = ${employeeId} LIMIT 1
  `
  if (rows[0]) return rows[0]
  return {
    employee_id: employeeId,
    sss_number: null,
    philhealth_number: null,
    pagibig_number: null,
    tin: null,
    sss_enrolled: true,
    philhealth_enrolled: true,
    pagibig_enrolled: true,
    notes: null,
  }
}

export async function upsertGovernmentProfile(employeeId: string, data: Record<string, unknown>) {
  const db = getDb()
  const existing = await getGovernmentProfile(employeeId)
  const sssNumber = 'sss_number' in data ? (data.sss_number ? String(data.sss_number) : null) : existing.sss_number
  const philhealthNumber =
    'philhealth_number' in data ? (data.philhealth_number ? String(data.philhealth_number) : null) : existing.philhealth_number
  const pagibigNumber =
    'pagibig_number' in data ? (data.pagibig_number ? String(data.pagibig_number) : null) : existing.pagibig_number
  const tin = 'tin' in data ? (data.tin ? String(data.tin) : null) : existing.tin
  const sssEnrolled = 'sss_enrolled' in data ? Boolean(data.sss_enrolled) : Boolean(existing.sss_enrolled)
  const philhealthEnrolled =
    'philhealth_enrolled' in data ? Boolean(data.philhealth_enrolled) : Boolean(existing.philhealth_enrolled)
  const pagibigEnrolled =
    'pagibig_enrolled' in data ? Boolean(data.pagibig_enrolled) : Boolean(existing.pagibig_enrolled)
  const notes = 'notes' in data ? (data.notes ? String(data.notes) : null) : existing.notes

  await db`
    INSERT INTO employee_government_profiles (
      employee_id, sss_number, philhealth_number, pagibig_number, tin,
      sss_enrolled, philhealth_enrolled, pagibig_enrolled, notes
    ) VALUES (
      ${employeeId}, ${sssNumber}, ${philhealthNumber}, ${pagibigNumber}, ${tin},
      ${sssEnrolled}, ${philhealthEnrolled}, ${pagibigEnrolled}, ${notes}
    )
    ON CONFLICT (employee_id) DO UPDATE SET
      sss_number = EXCLUDED.sss_number,
      philhealth_number = EXCLUDED.philhealth_number,
      pagibig_number = EXCLUDED.pagibig_number,
      tin = EXCLUDED.tin,
      sss_enrolled = EXCLUDED.sss_enrolled,
      philhealth_enrolled = EXCLUDED.philhealth_enrolled,
      pagibig_enrolled = EXCLUDED.pagibig_enrolled,
      notes = EXCLUDED.notes,
      updated_at = NOW()
  `
  return getGovernmentProfile(employeeId)
}

export async function contributionHistory(employeeId: string) {
  const rows = await unsafe<Record<string, unknown>>(
    `SELECT ps.id AS payslip_id, pr.pay_date, pr.period_start, pr.period_end,
      ps.gross_pay, ps.net_pay, ps.sss_amount, ps.philhealth_amount, ps.pagibig_amount, ps.tax_amount
     FROM payslips ps
     INNER JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
     WHERE ps.employee_id = $1
     ORDER BY pr.pay_date DESC
     LIMIT 24`,
    [employeeId],
  )

  const mapRows = (field: string) =>
    rows
      .filter((r) => Number(r[field]) > 0)
      .map((r) => ({
        payslip_id: String(r.payslip_id),
        pay_date: String(r.pay_date),
        period_start: String(r.period_start),
        period_end: String(r.period_end),
        gross_pay: Number(r.gross_pay),
        amount: Number(r[field]),
      }))

  const ytdYear = new Date().getFullYear()
  const sumYtd = (field: string) =>
    rows
      .filter((r) => String(r.pay_date).startsWith(String(ytdYear)))
      .reduce((sum, r) => sum + Number(r[field] || 0), 0)

  return {
    sss: mapRows('sss_amount'),
    philhealth: mapRows('philhealth_amount'),
    pagibig: mapRows('pagibig_amount'),
    tax: mapRows('tax_amount'),
    ytd: {
      sss: Math.round(sumYtd('sss_amount') * 100) / 100,
      philhealth: Math.round(sumYtd('philhealth_amount') * 100) / 100,
      pagibig: Math.round(sumYtd('pagibig_amount') * 100) / 100,
      tax: Math.round(sumYtd('tax_amount') * 100) / 100,
    },
    latest: rows[0]
      ? {
          pay_date: String(rows[0].pay_date),
          period_start: String(rows[0].period_start),
          period_end: String(rows[0].period_end),
          sss_amount: Number(rows[0].sss_amount),
          philhealth_amount: Number(rows[0].philhealth_amount),
          pagibig_amount: Number(rows[0].pagibig_amount),
          tax_amount: Number(rows[0].tax_amount),
          gross_pay: Number(rows[0].gross_pay),
          net_pay: Number(rows[0].net_pay),
        }
      : null,
  }
}

export async function getBenefitsOverview(employeeId: string) {
  const [compensation, profile, enrollments, history] = await Promise.all([
    getEmployeeCompensation(employeeId),
    getGovernmentProfile(employeeId),
    listEnrollments(employeeId),
    contributionHistory(employeeId),
  ])

  const monthly = compensation?.monthly_compensation ?? 0
  const shares = monthlyEmployeeShares(monthly)
  const perPayroll = {
    sss: Math.round((shares.sss / 2) * 100) / 100,
    philhealth: Math.round((shares.philhealth / 2) * 100) / 100,
    pagibig: Math.round((shares.pagibig / 2) * 100) / 100,
    tax: Math.round((shares.tax / 2) * 100) / 100,
  }

  const agencies = [
    {
      agency: 'sss' as const,
      label: 'SSS',
      member_id: profile.sss_number ? String(profile.sss_number) : null,
      enrolled: Boolean(profile.sss_enrolled),
      monthly_employee_share: profile.sss_enrolled ? shares.sss : 0,
      per_payroll_share: profile.sss_enrolled ? perPayroll.sss : 0,
      ytd: history.ytd.sss,
    },
    {
      agency: 'philhealth' as const,
      label: 'PhilHealth',
      member_id: profile.philhealth_number ? String(profile.philhealth_number) : null,
      enrolled: Boolean(profile.philhealth_enrolled),
      monthly_employee_share: profile.philhealth_enrolled ? shares.philhealth : 0,
      per_payroll_share: profile.philhealth_enrolled ? perPayroll.philhealth : 0,
      ytd: history.ytd.philhealth,
    },
    {
      agency: 'pagibig' as const,
      label: 'Pag-IBIG',
      member_id: profile.pagibig_number ? String(profile.pagibig_number) : null,
      enrolled: Boolean(profile.pagibig_enrolled),
      monthly_employee_share: profile.pagibig_enrolled ? shares.pagibig : 0,
      per_payroll_share: profile.pagibig_enrolled ? perPayroll.pagibig : 0,
      ytd: history.ytd.pagibig,
    },
  ]

  const activeEnrollments = enrollments.filter((e) => e.is_active)

  return {
    employee: compensation,
    profile,
    monthly_compensation: monthly,
    agencies,
    withholding_tax: {
      monthly: shares.tax,
      per_payroll: perPayroll.tax,
      ytd: history.ytd.tax,
    },
    enrollments: activeEnrollments,
    contribution_history: {
      sss: history.sss,
      philhealth: history.philhealth,
      pagibig: history.pagibig,
      tax: history.tax,
    },
    latest_payslip: history.latest,
  }
}
