import { getDb } from './db'
import { list as listEnrollments } from './benefits'
import { monthlyEmployeeShares, effectiveDeductionsFromMonthly, profileToDeductionConfig } from './payroll-ph-deductions'
import { ValidationError } from './errors'
import {
  normalizeGovernmentProfileFields,
  profileComplianceIssues,
  validateGovernmentProfileInput,
} from './government-id-validation'
import { unsafe, unsafeExec } from './sql'

export type GovernmentAgency = 'sss' | 'philhealth' | 'pagibig'
export type BulkDeductionAgency = GovernmentAgency | 'tax'

const BULK_AGENCY_COLUMNS: Record<
  BulkDeductionAgency,
  { idCol: string; amtCol: string; modeCol: string; enrolledCol: string; label: string }
> = {
  sss: {
    idCol: 'sss_number',
    amtCol: 'sss_monthly_amount',
    modeCol: 'sss_deduction_mode',
    enrolledCol: 'sss_enrolled',
    label: 'SSS',
  },
  philhealth: {
    idCol: 'philhealth_number',
    amtCol: 'philhealth_monthly_amount',
    modeCol: 'philhealth_deduction_mode',
    enrolledCol: 'philhealth_enrolled',
    label: 'PhilHealth',
  },
  pagibig: {
    idCol: 'pagibig_number',
    amtCol: 'pagibig_monthly_amount',
    modeCol: 'pagibig_deduction_mode',
    enrolledCol: 'pagibig_enrolled',
    label: 'Pag-IBIG',
  },
  tax: {
    idCol: 'tin',
    amtCol: 'tax_monthly_amount',
    modeCol: 'tax_deduction_mode',
    enrolledCol: 'tax_enrolled',
    label: 'Withholding tax',
  },
}

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
    sss_enrolled: false,
    philhealth_enrolled: false,
    pagibig_enrolled: false,
    sss_deduction_mode: 'manual',
    sss_monthly_amount: null,
    philhealth_deduction_mode: 'manual',
    philhealth_monthly_amount: null,
    pagibig_deduction_mode: 'manual',
    pagibig_monthly_amount: null,
    tax_deduction_mode: 'manual',
    tax_monthly_amount: null,
    tax_enrolled: false,
    notes: null,
  }
}

function parseDeductionMode() {
  return 'manual'
}

function syncEnrolledFlags(merged: Record<string, unknown>) {
  const has = (v: unknown) => Boolean(v && String(v).trim())
  if (!has(merged.sss_number)) merged.sss_enrolled = false
  if (!has(merged.philhealth_number)) merged.philhealth_enrolled = false
  if (!has(merged.pagibig_number)) merged.pagibig_enrolled = false
  if (!has(merged.tin)) merged.tax_enrolled = false
}

function parseMonthlyAmountField(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) throw new ValidationError('Deduction amount must be zero or positive')
  return Math.round(n * 100) / 100
}

export async function upsertGovernmentProfile(employeeId: string, data: Record<string, unknown>) {
  const db = getDb()
  const existing = await getGovernmentProfile(employeeId)
  const merged = {
    sss_number: 'sss_number' in data ? (data.sss_number ? String(data.sss_number) : null) : existing.sss_number,
    philhealth_number:
      'philhealth_number' in data
        ? data.philhealth_number
          ? String(data.philhealth_number)
          : null
        : existing.philhealth_number,
    pagibig_number:
      'pagibig_number' in data ? (data.pagibig_number ? String(data.pagibig_number) : null) : existing.pagibig_number,
    tin: 'tin' in data ? (data.tin ? String(data.tin) : null) : existing.tin,
    sss_enrolled: 'sss_enrolled' in data ? Boolean(data.sss_enrolled) : Boolean(existing.sss_enrolled),
    philhealth_enrolled:
      'philhealth_enrolled' in data ? Boolean(data.philhealth_enrolled) : Boolean(existing.philhealth_enrolled),
    pagibig_enrolled:
      'pagibig_enrolled' in data ? Boolean(data.pagibig_enrolled) : Boolean(existing.pagibig_enrolled),
    tax_enrolled: 'tax_enrolled' in data ? Boolean(data.tax_enrolled) : Boolean(existing.tax_enrolled ?? false),
    sss_deduction_mode: parseDeductionMode(),
    sss_monthly_amount:
      'sss_monthly_amount' in data
        ? parseMonthlyAmountField(data.sss_monthly_amount)
        : existing.sss_monthly_amount != null
          ? Number(existing.sss_monthly_amount)
          : null,
    philhealth_deduction_mode: parseDeductionMode(),
    philhealth_monthly_amount:
      'philhealth_monthly_amount' in data
        ? parseMonthlyAmountField(data.philhealth_monthly_amount)
        : existing.philhealth_monthly_amount != null
          ? Number(existing.philhealth_monthly_amount)
          : null,
    pagibig_deduction_mode: parseDeductionMode(),
    pagibig_monthly_amount:
      'pagibig_monthly_amount' in data
        ? parseMonthlyAmountField(data.pagibig_monthly_amount)
        : existing.pagibig_monthly_amount != null
          ? Number(existing.pagibig_monthly_amount)
          : null,
    tax_deduction_mode: parseDeductionMode(),
    tax_monthly_amount:
      'tax_monthly_amount' in data
        ? parseMonthlyAmountField(data.tax_monthly_amount)
        : existing.tax_monthly_amount != null
          ? Number(existing.tax_monthly_amount)
          : null,
    notes: 'notes' in data ? (data.notes ? String(data.notes) : null) : existing.notes,
  }

  validateGovernmentProfileInput(merged)
  const normalized = normalizeGovernmentProfileFields(merged)
  const row = { ...merged, ...normalized }
  syncEnrolledFlags(row)

  await db`
    INSERT INTO employee_government_profiles (
      employee_id, sss_number, philhealth_number, pagibig_number, tin,
      sss_enrolled, philhealth_enrolled, pagibig_enrolled,
      sss_deduction_mode, sss_monthly_amount,
      philhealth_deduction_mode, philhealth_monthly_amount,
      pagibig_deduction_mode, pagibig_monthly_amount,
      tax_deduction_mode, tax_monthly_amount, tax_enrolled,
      notes
    ) VALUES (
      ${employeeId}, ${normalized.sss_number}, ${normalized.philhealth_number}, ${normalized.pagibig_number}, ${normalized.tin},
      ${row.sss_enrolled}, ${row.philhealth_enrolled}, ${row.pagibig_enrolled},
      ${row.sss_deduction_mode}, ${row.sss_monthly_amount},
      ${row.philhealth_deduction_mode}, ${row.philhealth_monthly_amount},
      ${row.pagibig_deduction_mode}, ${row.pagibig_monthly_amount},
      ${row.tax_deduction_mode}, ${row.tax_monthly_amount}, ${row.tax_enrolled},
      ${row.notes}
    )
    ON CONFLICT (employee_id) DO UPDATE SET
      sss_number = EXCLUDED.sss_number,
      philhealth_number = EXCLUDED.philhealth_number,
      pagibig_number = EXCLUDED.pagibig_number,
      tin = EXCLUDED.tin,
      sss_enrolled = EXCLUDED.sss_enrolled,
      philhealth_enrolled = EXCLUDED.philhealth_enrolled,
      pagibig_enrolled = EXCLUDED.pagibig_enrolled,
      sss_deduction_mode = EXCLUDED.sss_deduction_mode,
      sss_monthly_amount = EXCLUDED.sss_monthly_amount,
      philhealth_deduction_mode = EXCLUDED.philhealth_deduction_mode,
      philhealth_monthly_amount = EXCLUDED.philhealth_monthly_amount,
      pagibig_deduction_mode = EXCLUDED.pagibig_deduction_mode,
      pagibig_monthly_amount = EXCLUDED.pagibig_monthly_amount,
      tax_deduction_mode = EXCLUDED.tax_deduction_mode,
      tax_monthly_amount = EXCLUDED.tax_monthly_amount,
      tax_enrolled = EXCLUDED.tax_enrolled,
      notes = EXCLUDED.notes,
      updated_at = NOW()
  `
  return getGovernmentProfile(employeeId)
}

export async function getDeductionSetup(employeeId: string) {
  const [compensation, profile] = await Promise.all([
    getEmployeeCompensation(employeeId),
    getGovernmentProfile(employeeId),
  ])
  const config = profileToDeductionConfig(profile as Record<string, unknown>)

  return {
    employee: compensation,
    profile,
    per_payroll: {
      semi_monthly: effectiveDeductionsFromMonthly(0, 'semi_monthly', config),
      monthly: effectiveDeductionsFromMonthly(0, 'monthly', config),
    },
  }
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
  const [compensation, profile, enrollments, history, profileRow] = await Promise.all([
    getEmployeeCompensation(employeeId),
    getGovernmentProfile(employeeId),
    listEnrollments(employeeId),
    contributionHistory(employeeId),
    getDb()`SELECT employee_id FROM employee_government_profiles WHERE employee_id = ${employeeId} LIMIT 1`,
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

  const complianceIssues = profileComplianceIssues({
    sss_number: profile.sss_number ? String(profile.sss_number) : null,
    philhealth_number: profile.philhealth_number ? String(profile.philhealth_number) : null,
    pagibig_number: profile.pagibig_number ? String(profile.pagibig_number) : null,
    tin: profile.tin ? String(profile.tin) : null,
    sss_enrolled: Boolean(profile.sss_enrolled),
    philhealth_enrolled: Boolean(profile.philhealth_enrolled),
    pagibig_enrolled: Boolean(profile.pagibig_enrolled),
    has_row: Boolean(profileRow[0]),
  })

  return {
    employee: compensation,
    profile,
    compliance_issues: complianceIssues,
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

export async function benefitsComplianceReport(branchId?: string | null) {
  const params: (string | number)[] = []
  let sql = `
    SELECT e.id, e.emp_number, e.first_name, e.last_name, e.branch_id, b.name AS branch_name,
      gp.sss_number, gp.philhealth_number, gp.pagibig_number, gp.tin,
      gp.sss_enrolled, gp.philhealth_enrolled, gp.pagibig_enrolled,
      (gp.employee_id IS NOT NULL) AS has_profile
    FROM employees e
    INNER JOIN branches b ON b.id = e.branch_id
    LEFT JOIN employee_government_profiles gp ON gp.employee_id = e.id
    WHERE e.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM users u
        INNER JOIN roles r ON r.role_id = u.role_id
        WHERE u.employee_id = e.id AND r.role_slug = 'admin'
      )`
  if (branchId) {
    params.push(branchId)
    sql += ` AND e.branch_id = $${params.length}`
  }
  sql += ' ORDER BY b.name, e.last_name, e.first_name'

  const rows = await unsafe<Record<string, unknown>>(sql, params)
  const employees = rows.map((row) => {
    const profile = {
      sss_number: row.sss_number ? String(row.sss_number) : null,
      philhealth_number: row.philhealth_number ? String(row.philhealth_number) : null,
      pagibig_number: row.pagibig_number ? String(row.pagibig_number) : null,
      tin: row.tin ? String(row.tin) : null,
      sss_enrolled: row.sss_enrolled !== false,
      philhealth_enrolled: row.philhealth_enrolled !== false,
      pagibig_enrolled: row.pagibig_enrolled !== false,
      has_row: Boolean(row.has_profile),
    }
    return {
      employee_id: String(row.id),
      emp_number: String(row.emp_number),
      first_name: String(row.first_name),
      last_name: String(row.last_name),
      branch_id: String(row.branch_id),
      branch_name: String(row.branch_name),
      issues: profileComplianceIssues(profile),
      profile,
    }
  })

  const withIssues = employees.filter((e) => e.issues.length > 0)
  return {
    total_active: employees.length,
    compliant: employees.length - withIssues.length,
    with_issues: withIssues.length,
    employees: withIssues,
  }
}

export async function remittanceSummary(year: number, month: number, branchId?: string | null) {
  if (month < 1 || month > 12) throw new ValidationError('month must be 1–12')
  const periodStart = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const periodEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const params: (string | number)[] = [periodStart, periodEnd]
  let branchClause = ''
  if (branchId) {
    params.push(branchId)
    branchClause = ` AND pr.branch_id = $${params.length}`
  }

  const totals = await unsafe<Record<string, unknown>>(
    `SELECT
      COUNT(DISTINCT ps.employee_id)::int AS employee_count,
      COUNT(ps.id)::int AS payslip_count,
      COALESCE(SUM(ps.sss_amount), 0) AS sss_employee,
      COALESCE(SUM(ps.philhealth_amount), 0) AS philhealth_employee,
      COALESCE(SUM(ps.pagibig_amount), 0) AS pagibig_employee,
      COALESCE(SUM(ps.tax_amount), 0) AS tax_withheld,
      COALESCE(SUM(ps.gross_pay), 0) AS total_gross
    FROM payslips ps
    INNER JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
    WHERE pr.pay_date BETWEEN $1 AND $2
      AND pr.status IN ('processing', 'partially_paid', 'paid', 'approved')
      ${branchClause}`,
    params,
  )

  const row = totals[0] ?? {}
  const sssEmp = Number(row.sss_employee ?? 0)
  const philEmp = Number(row.philhealth_employee ?? 0)
  const pagEmp = Number(row.pagibig_employee ?? 0)

  return {
    year,
    month,
    period_start: periodStart,
    period_end: periodEnd,
    branch_id: branchId ?? null,
    employee_count: Number(row.employee_count ?? 0),
    payslip_count: Number(row.payslip_count ?? 0),
    total_gross: Math.round(Number(row.total_gross ?? 0) * 100) / 100,
    agencies: [
      {
        agency: 'sss',
        label: 'SSS',
        employee_share: Math.round(sssEmp * 100) / 100,
        employer_share_est: Math.round(sssEmp * (0.095 / 0.045) * 100) / 100,
        total_est: Math.round((sssEmp + sssEmp * (0.095 / 0.045)) * 100) / 100,
      },
      {
        agency: 'philhealth',
        label: 'PhilHealth',
        employee_share: Math.round(philEmp * 100) / 100,
        employer_share_est: Math.round(philEmp * 100) / 100,
        total_est: Math.round(philEmp * 2 * 100) / 100,
      },
      {
        agency: 'pagibig',
        label: 'Pag-IBIG',
        employee_share: Math.round(pagEmp * 100) / 100,
        employer_share_est: Math.round(pagEmp * 100) / 100,
        total_est: Math.round(pagEmp * 2 * 100) / 100,
      },
    ],
    tax_withheld: Math.round(Number(row.tax_withheld ?? 0) * 100) / 100,
    status: 'draft',
    note: 'Employer shares are estimated from employee deductions using current statutory rates. Mark as submitted after filing.',
  }
}

export async function bulkDeductionEligible(agency: BulkDeductionAgency, branchId?: string | null) {
  const { idCol, label } = BULK_AGENCY_COLUMNS[agency]
  const params: (string | number)[] = []
  let sql = `
    SELECT COUNT(*)::int AS eligible
    FROM employees e
    INNER JOIN employee_government_profiles gp ON gp.employee_id = e.id
    WHERE e.status = 'active'
      AND gp.${idCol} IS NOT NULL AND TRIM(gp.${idCol}) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM users u
        INNER JOIN roles r ON r.role_id = u.role_id
        WHERE u.employee_id = e.id AND r.role_slug = 'admin'
      )`
  if (branchId) {
    params.push(branchId)
    sql += ` AND e.branch_id = $${params.length}`
  }
  const rows = await unsafe<{ eligible: number }>(sql, params)
  return { agency, label, eligible: Number(rows[0]?.eligible ?? 0) }
}

export async function bulkApplyMonthlyDeduction(
  agency: BulkDeductionAgency,
  monthlyAmount: number,
  branchId?: string | null,
) {
  if (!Number.isFinite(monthlyAmount) || monthlyAmount < 0) {
    throw new ValidationError('Monthly amount must be zero or positive')
  }
  const amt = Math.round(monthlyAmount * 100) / 100
  const { idCol, amtCol, modeCol, enrolledCol, label } = BULK_AGENCY_COLUMNS[agency]
  const params: (string | number)[] = [amt]
  let branchClause = ''
  if (branchId) {
    params.push(branchId)
    branchClause = ` AND e.branch_id = $${params.length}`
  }
  const updated = await unsafeExec(
    `UPDATE employee_government_profiles gp
     SET ${modeCol} = 'manual', ${amtCol} = $1, ${enrolledCol} = true, updated_at = NOW()
     FROM employees e
     WHERE gp.employee_id = e.id
       AND e.status = 'active'
       AND gp.${idCol} IS NOT NULL AND TRIM(gp.${idCol}) <> ''
       AND NOT EXISTS (
         SELECT 1 FROM users u
         INNER JOIN roles r ON r.role_id = u.role_id
         WHERE u.employee_id = e.id AND r.role_slug = 'admin'
       )
       ${branchClause}`,
    params,
  )
  return { agency, label, updated, monthly_amount: amt }
}
