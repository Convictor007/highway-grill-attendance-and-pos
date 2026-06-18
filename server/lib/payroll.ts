import { ValidationError } from './errors'
import { unsafe, unsafeExec, type SqlValue } from './sql'
import { forPayPeriod, thirteenthMonthTax } from './payroll-ph-deductions'
import { getGovernmentProfile } from './government-benefits'
import * as payrollAdjustments from './payroll-adjustments'
import { holidayHoursInPeriod, holidayPremiumPay } from './holidays'
import { periodTotalForEmployee } from './benefits'
import {
  applyPayrollDeduction,
  reversePayrollDeductions,
  estimatedPayrollDeduction,
  list as listLoans,
} from './loans'
export { sendRunPayslips, sendPayslip } from './payroll-payslip-mail'

type PaginatedResult<T> = {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}

type PayConfig = { basis: 'daily' | 'hourly'; rate: number; hourly: number }

type PayslipComputeRow = {
  regular_hours: number
  overtime_hours: number
  holiday_hours: number
  basic_pay: number
  overtime_pay: number
  holiday_pay: number
  tips_amount: number
  benefits_amount: number
  gross_pay: number
  sss_amount: number
  philhealth_amount: number
  pagibig_amount: number
  tax_amount: number
  other_deductions: number
  net_pay: number
  adj_debits: number
}

function paginatedResult<T>(items: T[], total: number, page: number, limit: number): PaginatedResult<T> {
  const pages = total > 0 && limit > 0 ? Math.ceil(total / limit) : 0
  return { items, total, page, limit, pages }
}

function payConfigFromRow(empPay: Record<string, unknown>): PayConfig {
  const rate = Number(empPay.rate ?? 80)
  const basis = String(empPay.pay_basis ?? 'hourly')
  return {
    basis: basis === 'daily' ? 'daily' : 'hourly',
    rate,
    hourly: basis === 'daily' ? (rate > 0 ? rate / 8 : 0) : rate,
  }
}

async function existingPayslipId(runId: string, employeeId: string): Promise<string | null> {
  const rows = await unsafe<{ id: string }>(
    `SELECT id FROM payslips WHERE payroll_run_id = $1 AND employee_id = $2 LIMIT 1`,
    [runId, employeeId],
  )
  return rows[0]?.id ? String(rows[0].id) : null
}

function payslipBindParams(row: PayslipComputeRow, runId?: string, employeeId?: string) {
  const params: SqlValue[] = [
    row.regular_hours,
    row.overtime_hours,
    row.holiday_hours,
    row.basic_pay,
    row.overtime_pay,
    row.holiday_pay,
    row.tips_amount,
    row.benefits_amount,
    row.gross_pay,
    row.sss_amount,
    row.philhealth_amount,
    row.pagibig_amount,
    row.tax_amount,
    row.other_deductions,
    row.net_pay,
  ]
  if (runId && employeeId) {
    return [runId, employeeId, ...params] as SqlValue[]
  }
  return params
}

async function insertPayslipRow(runId: string, employeeId: string, row: PayslipComputeRow): Promise<void> {
  const bind = payslipBindParams(row, runId, employeeId)
  await unsafeExec(
    `INSERT INTO payslips (payroll_run_id, employee_id, regular_hours, overtime_hours, holiday_hours,
     basic_pay, overtime_pay, holiday_pay, tips_amount, service_charge, gross_pay,
     sss_amount, philhealth_amount, pagibig_amount, tax_amount, other_deductions, net_pay, generated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())`,
    bind,
  )
}

async function updatePayslipRow(payslipId: string, row: PayslipComputeRow): Promise<void> {
  const bind = payslipBindParams(row)
  await unsafeExec(
    `UPDATE payslips SET regular_hours = $1, overtime_hours = $2, holiday_hours = $3,
     basic_pay = $4, overtime_pay = $5, holiday_pay = $6, tips_amount = $7, service_charge = $8,
     gross_pay = $9, sss_amount = $10, philhealth_amount = $11, pagibig_amount = $12,
     tax_amount = $13, other_deductions = $14, net_pay = $15, generated_at = NOW()
     WHERE id = $16`,
    [...bind, payslipId],
  )
}

function applyNetPay(row: PayslipComputeRow): PayslipComputeRow {
  row.net_pay = Math.max(
    0,
    Math.round(
      (row.gross_pay -
        row.sss_amount -
        row.philhealth_amount -
        row.pagibig_amount -
        row.tax_amount -
        row.other_deductions) *
        100,
    ) / 100,
  )
  return row
}

function finalizePayslipAmounts(
  row: PayslipComputeRow,
  loanDeduction: number,
  cashAdvance: number,
  housingDeduction = 0,
): PayslipComputeRow {
  row.other_deductions = Math.round((row.adj_debits + loanDeduction + cashAdvance + housingDeduction) * 100) / 100
  return applyNetPay(row)
}

async function housingDeductionForEmployee(
  employeeId: string,
  payFrequency = 'semi_monthly',
): Promise<number> {
  const rows = await unsafe<{ is_stay_in: boolean; housing_deduction: string }>(
    `SELECT is_stay_in, housing_deduction FROM employees WHERE id = $1 LIMIT 1`,
    [employeeId],
  )
  const row = rows[0]
  if (!row || !row.is_stay_in) return 0
  const monthly = Math.max(0, Math.round(Number(row.housing_deduction ?? 0) * 100) / 100)
  if (monthly <= 0) return 0
  if (payFrequency === 'monthly') return monthly
  return Math.round((monthly / 2) * 100) / 100
}

async function approvedOvertimeHours(employeeId: string, from: string, to: string): Promise<number> {
  const rows = await unsafe<{ h: string }>(
    `SELECT COALESCE(SUM(extra_hours), 0) AS h FROM overtime_requests
     WHERE employee_id = $1 AND status = 'approved' AND request_date BETWEEN $2 AND $3`,
    [employeeId, from, to],
  )
  return Math.round(Number(rows[0]?.h ?? 0) * 100) / 100
}

async function countPayDays(
  employeeId: string,
  from: string,
  to: string,
  includedDates: string[] | null,
): Promise<number> {
  if (includedDates && includedDates.length > 0) {
    const placeholders = includedDates.map((_, i) => `$${i + 2}`).join(', ')
    const rows = await unsafe<{ c: string }>(
      `SELECT COUNT(DISTINCT DATE(clock_in)) AS c FROM attendance
       WHERE employee_id = $1 AND DATE(clock_in) IN (${placeholders})`,
      [employeeId, ...includedDates],
    )
    return Number(rows[0]?.c ?? 0)
  }
  const rows = await unsafe<{ c: string }>(
    `SELECT COUNT(DISTINCT DATE(clock_in)) AS c FROM attendance
     WHERE employee_id = $1 AND DATE(clock_in) BETWEEN $2 AND $3`,
    [employeeId, from, to],
  )
  return Number(rows[0]?.c ?? 0)
}

async function sumPayHours(
  employeeId: string,
  from: string,
  to: string,
  includedDates: string[] | null,
): Promise<number> {
  if (includedDates && includedDates.length > 0) {
    const placeholders = includedDates.map((_, i) => `$${i + 2}`).join(', ')
    const rows = await unsafe<{ h: string }>(
      `SELECT COALESCE(SUM(actual_hours), 0) AS h FROM attendance
       WHERE employee_id = $1 AND DATE(clock_in) IN (${placeholders})`,
      [employeeId, ...includedDates],
    )
    return Math.round(Number(rows[0]?.h ?? 0) * 100) / 100
  }
  const rows = await unsafe<{ h: string }>(
    `SELECT COALESCE(SUM(actual_hours), 0) AS h FROM attendance
     WHERE employee_id = $1 AND DATE(clock_in) BETWEEN $2 AND $3`,
    [employeeId, from, to],
  )
  return Math.round(Number(rows[0]?.h ?? 0) * 100) / 100
}

async function computeRegularPayslip(
  runRow: Record<string, unknown>,
  employeeId: string,
  pay: PayConfig,
  payFrequency: string,
  includedDates: string[] | null = null,
): Promise<PayslipComputeRow> {
  const periodStart = String(runRow.period_start)
  const periodEnd = String(runRow.period_end)
  const branchId = String(runRow.branch_id)
  const hourly = pay.hourly
  const rate = pay.rate

  let regularHours: number
  let basicPay: number
  if (pay.basis === 'daily') {
    regularHours = await countPayDays(employeeId, periodStart, periodEnd, includedDates)
    basicPay = Math.round(regularHours * rate * 100) / 100
  } else {
    regularHours = await sumPayHours(employeeId, periodStart, periodEnd, includedDates)
    basicPay = Math.round(regularHours * rate * 100) / 100
  }

  const holidayHours = await holidayHoursInPeriod(employeeId, periodStart, periodEnd, branchId)
  const holidayPay = await holidayPremiumPay(employeeId, periodStart, periodEnd, branchId, hourly)
  const overtimeHours = await approvedOvertimeHours(employeeId, periodStart, periodEnd)
  const overtimePay = Math.round(overtimeHours * hourly * 1.25 * 100) / 100
  const benefitsAmount = await periodTotalForEmployee(employeeId, payFrequency)
  const adj = await payrollAdjustments.totalsForEmployee(employeeId, String(runRow.id))
  const adjNet = Number(adj.net)
  const adjDebits = Math.max(0, -adjNet)
  const gross = Math.round((basicPay + holidayPay + overtimePay + benefitsAmount + Math.max(0, adjNet)) * 100) / 100
  const profile = await getGovernmentProfile(employeeId)
  const deductions = forPayPeriod(gross, payFrequency, {
    sss_enrolled: Boolean(profile.sss_enrolled),
    philhealth_enrolled: Boolean(profile.philhealth_enrolled),
    pagibig_enrolled: Boolean(profile.pagibig_enrolled),
  })

  return {
    regular_hours: regularHours,
    overtime_hours: overtimeHours,
    holiday_hours: holidayHours,
    basic_pay: basicPay,
    overtime_pay: overtimePay,
    holiday_pay: holidayPay,
    tips_amount: 0,
    benefits_amount: benefitsAmount,
    gross_pay: gross,
    sss_amount: deductions.sss,
    philhealth_amount: deductions.philhealth,
    pagibig_amount: deductions.pagibig,
    tax_amount: deductions.tax,
    other_deductions: adjDebits,
    net_pay: 0,
    adj_debits: adjDebits,
  }
}

function assertCanRegenerate(runRow: Record<string, unknown>): void {
  const status = String(runRow.status ?? '')
  if (!['draft', 'processing'].includes(status)) {
    throw new Error('Can only regenerate draft or processing payroll runs')
  }
}

async function finalizeRun(runId: string, created: number) {
  await syncRunDisbursementStatus(runId)
  return { created, payslips: await payslips(runId) }
}

async function loanDeductionForRun(employeeId: string, payrollRunId: string): Promise<number> {
  const note = `Payroll deduction (run ${payrollRunId})`
  const rows = await unsafe<{ total: string }>(
    `SELECT COALESCE(SUM(lp.amount), 0) AS total
     FROM loan_payments lp
     INNER JOIN employee_loans el ON el.id = lp.loan_id
     WHERE el.employee_id = $1 AND lp.notes = $2`,
    [employeeId, note],
  )
  return Math.round(Number(rows[0]?.total ?? 0) * 100) / 100
}

function rosterSearchClause(q: string, paramIndex = 2): [string, SqlValue[]] {
  if (q === '') return ['', []]
  return [
    ` AND (e.first_name ILIKE $${paramIndex} OR e.last_name ILIKE $${paramIndex} OR e.emp_number ILIKE $${paramIndex}
       OR (e.first_name || ' ' || e.last_name) ILIKE $${paramIndex})`,
    [`%${q}%`],
  ]
}

async function isDeferred(runId: string, employeeId: string): Promise<boolean> {
  const rows = await unsafe<{ one: number }>(
    `SELECT 1 AS one FROM payroll_run_deferrals WHERE payroll_run_id = $1 AND employee_id = $2 LIMIT 1`,
    [runId, employeeId],
  )
  return rows.length > 0
}

async function clearDeferral(runId: string, employeeId: string): Promise<void> {
  await unsafeExec(
    `DELETE FROM payroll_run_deferrals WHERE payroll_run_id = $1 AND employee_id = $2`,
    [runId, employeeId],
  )
}

function assertRunOpenForDisbursement(run: Record<string, unknown>): void {
  const status = String(run.status ?? '')
  if (['paid', 'cancelled'].includes(status)) {
    throw new Error('This payroll run is closed')
  }
}

function assertRunStatusTransition(from: string, to: string, runId: string): void {
  if (to === from) return
  if (to === 'cancelled') {
    if (from === 'paid') throw new ValidationError('Cannot cancel a paid payroll run')
    return
  }
  const valid: Record<string, string[]> = {
    draft: ['processing', 'cancelled'],
    processing: ['partially_paid', 'paid', 'approved', 'cancelled'],
    partially_paid: ['paid', 'processing', 'cancelled'],
    approved: ['paid', 'cancelled'],
    paid: [],
    cancelled: [],
  }
  if (!(valid[from] ?? []).includes(to)) {
    throw new ValidationError(`Cannot change payroll run status from ${from} to ${to}`)
  }
  if (to === 'approved') {
    // checked async in updateRun
    void runId
  }
}

async function countRosterEmployees(run: Record<string, unknown>, q = ''): Promise<number> {
  const [searchSql, searchParams] = rosterSearchClause(q, 2)
  const params: SqlValue[] = [String(run.branch_id), ...searchParams]
  const rows = await unsafe<{ c: string }>(
    `SELECT COUNT(*) AS c FROM employees e
     WHERE e.branch_id = $1 AND e.status = 'active'${searchSql}`,
    params,
  )
  return Number(rows[0]?.c ?? 0)
}

async function buildRosterEntries(
  runId: string,
  run: Record<string, unknown>,
  q = '',
  limit?: number,
  offset?: number,
): Promise<Record<string, unknown>[]> {
  const [searchSql, searchParams] = rosterSearchClause(q, 2)
  const params: SqlValue[] = [String(run.branch_id), ...searchParams]
  let sql = `SELECT e.id, e.emp_number, e.first_name, e.last_name, e.pay_basis, e.pay_rate,
      COALESCE(e.pay_rate, p.min_hourly, 80) AS rate,
      p.title AS position_title, d.name AS department_name
    FROM employees e
    LEFT JOIN positions p ON p.id = e.position_id
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE e.branch_id = $1 AND e.status = 'active'${searchSql}
    ORDER BY e.last_name, e.first_name`
  if (limit !== undefined) {
    const limIdx = params.length + 1
    params.push(limit)
    sql += ` LIMIT $${limIdx}`
    params.push(offset ?? 0)
    sql += ` OFFSET $${params.length}`
  }
  const emps = await unsafe<Record<string, unknown>>(sql, params)
  const periodStart = String(run.period_start)
  const periodEnd = String(run.period_end)
  const roster: Record<string, unknown>[] = []

  for (const emp of emps) {
    const employeeId = String(emp.id)
    const pay = payConfigFromRow(emp)
    const daysOrHours =
      pay.basis === 'daily'
        ? await countPayDays(employeeId, periodStart, periodEnd, null)
        : await sumPayHours(employeeId, periodStart, periodEnd, null)

    const payslipId = await existingPayslipId(runId, employeeId)
    let payslip: Record<string, unknown> | null = null
    if (payslipId) {
      const ps = await unsafe<Record<string, unknown>>(
        `SELECT id, net_pay, gross_pay, regular_hours, payment_status FROM payslips WHERE id = $1`,
        [payslipId],
      )
      payslip = ps[0] ?? null
    }

    roster.push({
      employee_id: employeeId,
      emp_number: emp.emp_number,
      first_name: emp.first_name,
      last_name: emp.last_name,
      position_title: emp.position_title,
      department_name: emp.department_name,
      pay_basis: pay.basis,
      pay_rate: pay.rate,
      days_or_hours: daysOrHours,
      payslip_id: payslipId,
      payslip_net: payslip ? Number(payslip.net_pay) : null,
      payslip_gross: payslip ? Number(payslip.gross_pay) : null,
      payment_status: await disbursementStatusFor(runId, employeeId, payslip),
      defer_note: await deferNoteFor(runId, employeeId),
    })
  }

  return roster
}

function summarizeRosterEntries(roster: Record<string, unknown>[]) {
  const counts = { pending: 0, ready: 0, paid: 0, deferred: 0 }
  let netReady = 0
  let netPaid = 0
  for (const emp of roster) {
    const st = String(emp.payment_status ?? 'pending')
    if (st in counts) counts[st as keyof typeof counts]++
    if (st === 'ready' && emp.payslip_net !== null) netReady += Number(emp.payslip_net)
    if (st === 'paid' && emp.payslip_net !== null) netPaid += Number(emp.payslip_net)
  }
  return {
    total_employees: roster.length,
    pending: counts.pending,
    ready: counts.ready,
    paid: counts.paid,
    deferred: counts.deferred,
    net_ready: Math.round(netReady * 100) / 100,
    net_paid: Math.round(netPaid * 100) / 100,
  }
}

async function syncRunDisbursementStatus(runId: string): Promise<void> {
  const sumRows = await unsafe<{ g: string; n: string }>(
    `SELECT COALESCE(SUM(gross_pay), 0) AS g, COALESCE(SUM(net_pay), 0) AS n
     FROM payslips WHERE payroll_run_id = $1`,
    [runId],
  )
  const sum = sumRows[0] ?? { g: '0', n: '0' }
  const summary = await disbursementSummary(runId)
  const total = Number(summary.total_employees ?? 0)
  const paid = Number(summary.paid ?? 0)
  const deferred = Number(summary.deferred ?? 0)
  const ready = Number(summary.ready ?? 0)
  const pending = Number(summary.pending ?? 0)

  const cntRows = await unsafe<{ c: string }>(
    `SELECT COUNT(*) AS c FROM payslips WHERE payroll_run_id = $1`,
    [runId],
  )
  const payslipCount = Number(cntRows[0]?.c ?? 0)

  let status = 'draft'
  if (total > 0 && paid + deferred >= total) {
    status = 'paid'
  } else if (paid > 0 && (ready > 0 || pending > 0)) {
    status = 'partially_paid'
  } else if (payslipCount > 0 || paid > 0 || ready > 0 || deferred > 0) {
    status = 'processing'
  }

  let sql = `UPDATE payroll_runs SET total_gross = $1, total_net = $2, status = $3`
  const params: SqlValue[] = [Number(sum.g), Number(sum.n), status]
  if (status === 'paid') {
    sql += ', processed_at = COALESCE(processed_at, NOW())'
  }
  sql += ` WHERE id = $${params.length + 1}`
  params.push(runId)
  await unsafeExec(sql, params)
}

export async function listRuns(
  branchId?: string | null,
  status?: string | null,
  q = '',
  page = 1,
  limit = 25,
): Promise<PaginatedResult<Record<string, unknown>>> {
  page = Math.max(1, page)
  limit = Math.max(1, Math.min(100, limit))
  const offset = (page - 1) * limit
  const params: SqlValue[] = []
  let where = ' WHERE 1=1'
  if (branchId) {
    params.push(branchId)
    where += ` AND pr.branch_id = $${params.length}`
  }
  if (status !== null && status !== undefined && status !== '') {
    params.push(status)
    where += ` AND pr.status = $${params.length}`
  }
  if (q !== '') {
    params.push(`%${q}%`)
    const p = params.length
    where += ` AND (b.name ILIKE $${p} OR pr.period_start::text ILIKE $${p} OR pr.period_end::text ILIKE $${p}
      OR pr.pay_date::text ILIKE $${p} OR pr.status ILIKE $${p})`
  }

  const countRows = await unsafe<{ c: string }>(
    `SELECT COUNT(*) AS c FROM payroll_runs pr INNER JOIN branches b ON b.id = pr.branch_id${where}`,
    params,
  )
  const total = Number(countRows[0]?.c ?? 0)

  const listParams = [...params, limit, offset]
  const items = await unsafe<Record<string, unknown>>(
    `SELECT pr.*, b.name AS branch_name FROM payroll_runs pr
     INNER JOIN branches b ON b.id = pr.branch_id${where}
     ORDER BY pr.period_end DESC, pr.created_at DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  )

  return paginatedResult(items, total, page, limit)
}

export async function createRun(data: Record<string, unknown>, userId: string) {
  const runType = String(data.run_type ?? 'regular') === '13th_month' ? '13th_month' : 'regular'
  const payFrequency = String(data.pay_frequency ?? 'semi_monthly') === 'monthly' ? 'monthly' : 'semi_monthly'
  const rows = await unsafe<Record<string, unknown>>(
    `INSERT INTO payroll_runs (branch_id, period_start, period_end, pay_date, run_type, pay_frequency, status, processed_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7)
     RETURNING *`,
    [
      String(data.branch_id),
      String(data.period_start),
      String(data.period_end),
      String(data.pay_date),
      runType,
      payFrequency,
      userId,
    ],
  )
  return rows[0]
}

export async function payslipsForEmployee(employeeId: string) {
  return unsafe<Record<string, unknown>>(
    `SELECT ps.*, pr.period_start, pr.period_end, pr.pay_date, pr.status AS run_status
     FROM payslips ps
     INNER JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
     WHERE ps.employee_id = $1 AND ps.payment_status = 'paid'
     ORDER BY pr.pay_date DESC`,
    [employeeId],
  )
}

export async function payslips(
  runId?: string | null,
  q = '',
  page = 1,
  limit = 25,
): Promise<PaginatedResult<Record<string, unknown>>> {
  if (!runId) return paginatedResult([], 0, page, limit)

  page = Math.max(1, page)
  limit = Math.max(1, Math.min(100, limit))
  const offset = (page - 1) * limit
  const params: SqlValue[] = [runId]
  let where = ' WHERE ps.payroll_run_id = $1'
  if (q !== '') {
    params.push(`%${q}%`)
    where += ` AND (e.first_name ILIKE $2 OR e.last_name ILIKE $2 OR e.emp_number ILIKE $2
      OR (e.first_name || ' ' || e.last_name) ILIKE $2)`
  }

  const countRows = await unsafe<{ c: string }>(
    `SELECT COUNT(*) AS c FROM payslips ps INNER JOIN employees e ON e.id = ps.employee_id${where}`,
    params,
  )
  const total = Number(countRows[0]?.c ?? 0)

  const listParams = [...params, limit, offset]
  const items = await unsafe<Record<string, unknown>>(
    `SELECT ps.*, e.emp_number, e.first_name, e.last_name
     FROM payslips ps
     INNER JOIN employees e ON e.id = ps.employee_id${where}
     ORDER BY e.last_name, e.first_name
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  )

  return paginatedResult(items, total, page, limit)
}

export async function generatePayslips(runId: string, replace = false) {
  const runRows = await unsafe<Record<string, unknown>>(
    `SELECT * FROM payroll_runs WHERE id = $1 LIMIT 1`,
    [runId],
  )
  const runRow = runRows[0]
  if (!runRow) throw new Error('Payroll run not found')

  if (replace) {
    assertCanRegenerate(runRow)
    await reversePayrollDeductions(runId)
    await unsafeExec(`DELETE FROM payslips WHERE payroll_run_id = $1`, [runId])
  }

  if (String(runRow.run_type ?? 'regular') === '13th_month') {
    return generate13thMonthPayslips(runId, runRow, replace)
  }

  const branchId = String(runRow.branch_id)
  const payFrequency = String(runRow.pay_frequency ?? 'semi_monthly')
  const emps = await unsafe<Record<string, unknown>>(
    `SELECT e.id, e.pay_basis, e.pay_rate, COALESCE(e.pay_rate, p.min_hourly, 80) AS rate
     FROM employees e
     LEFT JOIN positions p ON p.id = e.position_id
     WHERE e.branch_id = $1 AND e.status = 'active'`,
    [branchId],
  )

  let created = 0
  let updated = 0

  for (const emp of emps) {
    const employeeId = String(emp.id)
    const existingId = await existingPayslipId(runId, employeeId)
    if (existingId && !replace) continue

    let row = await computeRegularPayslip(runRow, employeeId, payConfigFromRow(emp), payFrequency)
    let cashAdvance = 0
    for (const adj of await payrollAdjustments.listAdjustments(employeeId, runId)) {
      if (['advance', 'penalty'].includes(String(adj.adj_type ?? ''))) {
        cashAdvance += Number(adj.amount ?? 0)
      }
    }
    const loanDeduction = await applyPayrollDeduction(employeeId, runId, String(runRow.pay_date))
    const housing = await housingDeductionForEmployee(employeeId, payFrequency)
    row = finalizePayslipAmounts(row, loanDeduction, Math.round(cashAdvance * 100) / 100, housing)

    if (existingId) {
      await updatePayslipRow(existingId, row)
      updated++
    } else {
      await insertPayslipRow(runId, employeeId, row)
      created++
    }

    const payslipId = existingId ?? (await existingPayslipId(runId, employeeId))
    if (payslipId) {
      await unsafeExec(
        `UPDATE payslips SET payment_status = 'ready', paid_at = NULL WHERE id = $1`,
        [payslipId],
      )
    }
    await clearDeferral(runId, employeeId)
  }

  return finalizeRun(runId, created + updated)
}

export async function generate13thMonthPayslips(
  runId: string,
  runRow: Record<string, unknown> | null = null,
  replace = false,
) {
  let run = runRow
  if (!run) {
    const rows = await unsafe<Record<string, unknown>>(`SELECT * FROM payroll_runs WHERE id = $1 LIMIT 1`, [runId])
    run = rows[0]
    if (!run) throw new Error('Payroll run not found')
  }

  const payDate = String(run.pay_date)
  const year = new Date(payDate).getFullYear()
  const emps = await unsafe<Record<string, unknown>>(
    `SELECT e.id FROM employees e WHERE e.branch_id = $1 AND e.status = 'active'`,
    [String(run.branch_id)],
  )

  let created = 0

  for (const emp of emps) {
    const employeeId = String(emp.id)
    const existingId = await existingPayslipId(runId, employeeId)
    if (existingId && !replace) continue

    const basicRows = await unsafe<{ s: string }>(
      `SELECT COALESCE(SUM(ps.basic_pay), 0) AS s
       FROM payslips ps
       INNER JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
       WHERE ps.employee_id = $1 AND pr.branch_id = $2
         AND EXTRACT(YEAR FROM pr.period_end) = $3
         AND pr.status IN ('processing', 'approved', 'paid')
         AND (pr.run_type IS NULL OR pr.run_type = 'regular')`,
      [employeeId, String(run.branch_id), year],
    )
    const totalBasic = Number(basicRows[0]?.s ?? 0)
    const thirteenth = Math.round((totalBasic / 12) * 100) / 100
    if (thirteenth <= 0) continue

    const tax = thirteenthMonthTax(thirteenth)
    const net = Math.round((thirteenth - tax) * 100) / 100

    if (existingId) {
      await unsafeExec(
        `UPDATE payslips SET regular_hours = 0, basic_pay = $1, gross_pay = $2,
         tax_amount = $3, other_deductions = 0, net_pay = $4, generated_at = NOW()
         WHERE id = $5`,
        [thirteenth, thirteenth, tax, net, existingId],
      )
    } else {
      await unsafeExec(
        `INSERT INTO payslips (payroll_run_id, employee_id, regular_hours, basic_pay, gross_pay,
         tax_amount, other_deductions, net_pay, generated_at)
         VALUES ($1, $2, 0, $3, $4, $5, 0, $6, NOW())`,
        [runId, employeeId, thirteenth, thirteenth, tax, net],
      )
    }
    created++
  }

  return finalizeRun(runId, created)
}

export function periodDateList(start: string, end: string): string[] {
  const dates: string[] = []
  const d = new Date(start)
  const endDt = new Date(end)
  while (d <= endDt) {
    dates.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return dates
}

export async function attendanceByPeriodDay(employeeId: string, periodStart: string, periodEnd: string) {
  const rows = await unsafe<Record<string, unknown>>(
    `SELECT DATE(clock_in) AS work_date, clock_in, clock_out, actual_hours, overtime_hours
     FROM attendance
     WHERE employee_id = $1 AND DATE(clock_in) BETWEEN $2 AND $3
     ORDER BY clock_in`,
    [employeeId, periodStart, periodEnd],
  )
  const byDate: Record<string, Record<string, unknown>> = {}
  for (const row of rows) {
    byDate[String(row.work_date).slice(0, 10)] = row
  }

  const out: Record<string, unknown>[] = []
  for (const date of periodDateList(periodStart, periodEnd)) {
    const att = byDate[date] ?? null
    out.push({
      date,
      present: att !== null,
      clock_in: att?.clock_in ?? null,
      clock_out: att?.clock_out ?? null,
      actual_hours: att ? Number(att.actual_hours) : 0,
      overtime_hours: att ? Number(att.overtime_hours ?? 0) : 0,
    })
  }
  return out
}

export async function runRoster(runId: string, q = '', page = 1, limit = 25) {
  const run = await getRun(runId)
  if (!run) throw new Error('Payroll run not found')

  page = Math.max(1, page)
  limit = Math.max(1, Math.min(100, limit))
  const offset = (page - 1) * limit
  const total = await countRosterEmployees(run, q)
  const roster = await buildRosterEntries(runId, run, q, limit, offset)
  const pageMeta = paginatedResult([], total, page, limit)

  return {
    run,
    employees: roster,
    summary: await disbursementSummary(runId),
    total: pageMeta.total,
    page: pageMeta.page,
    limit: pageMeta.limit,
    pages: pageMeta.pages,
  }
}

export async function prepareEmployee(
  runId: string,
  employeeId: string,
  includedDates: string[] | null = null,
  attendanceEditMode = false,
) {
  const run = await getRun(runId)
  if (!run) throw new Error('Payroll run not found')

  const empRows = await unsafe<Record<string, unknown>>(
    `SELECT e.id, e.emp_number, e.first_name, e.last_name, e.branch_id, e.pay_basis, e.pay_rate,
      COALESCE(e.pay_rate, p.min_hourly, 80) AS rate,
      p.title AS position_title, d.name AS department_name
     FROM employees e
     LEFT JOIN positions p ON p.id = e.position_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE e.id = $1 AND e.branch_id = $2 LIMIT 1`,
    [employeeId, String(run.branch_id)],
  )
  const emp = empRows[0]
  if (!emp) throw new ValidationError('Employee not in this payroll branch')

  const periodStart = String(run.period_start)
  const periodEnd = String(run.period_end)
  const pay = payConfigFromRow(emp)
  const payFrequency = String(run.pay_frequency ?? 'semi_monthly')

  const attendance = await attendanceByPeriodDay(employeeId, periodStart, periodEnd)
  if (includedDates === null) {
    includedDates = attendance.filter((d) => d.present).map((d) => String(d.date))
  }

  const adjustments = await payrollAdjustments.listAdjustments(employeeId, runId)
  let cashAdvance = 0
  for (const adj of adjustments) {
    if (['advance', 'penalty'].includes(String(adj.adj_type ?? ''))) {
      cashAdvance += Number(adj.amount ?? 0)
    }
  }
  cashAdvance = Math.round(cashAdvance * 100) / 100

  const computed = await computeRegularPayslip(run, employeeId, pay, payFrequency, includedDates)
  const loanEst = await estimatedPayrollDeduction(employeeId)
  const housing = await housingDeductionForEmployee(employeeId, payFrequency)
  const preview: Record<string, unknown> = {
    ...finalizePayslipAmounts(computed, loanEst, cashAdvance, housing),
    loan_deduction: loanEst,
    cash_advance: cashAdvance,
    housing_deduction: housing,
  }

  const payslipId = await existingPayslipId(runId, employeeId)
  const payslip = payslipId ? await getPayslip(payslipId) : null

  if (payslip && !attendanceEditMode) {
    for (const field of [
      'regular_hours',
      'basic_pay',
      'overtime_pay',
      'gross_pay',
      'sss_amount',
      'philhealth_amount',
      'pagibig_amount',
      'tax_amount',
      'other_deductions',
      'net_pay',
    ]) {
      if (payslip[field] !== undefined) preview[field] = Number(payslip[field])
    }
    preview.loan_deduction = Number(payslip.loan_deduction ?? loanEst)
    preview.cash_advance = Number(payslip.cash_advance ?? cashAdvance)
    preview.housing_deduction = Number(payslip.housing_deduction ?? housing)
  }

  const loans = await listLoans(employeeId)
  const activeLoans = loans.filter(
    (l) => String(l.status ?? '') === 'active' && Number(l.balance ?? 0) > 0,
  )

  return {
    run,
    employee: emp,
    pay_basis: pay.basis,
    pay_rate: pay.rate,
    attendance,
    included_dates: includedDates,
    preview,
    loans: activeLoans,
    adjustments,
    payslip,
    can_edit: ['draft', 'processing', 'partially_paid'].includes(String(run.status ?? '')),
  }
}

export async function generatePayslipForEmployee(
  runId: string,
  employeeId: string,
  options: Record<string, unknown> = {},
) {
  const run = await getRun(runId)
  if (!run) throw new Error('Payroll run not found')
  if (!['draft', 'processing', 'partially_paid'].includes(String(run.status ?? ''))) {
    throw new Error('Cannot generate payslips for a closed payroll run')
  }

  await clearDeferral(runId, employeeId)

  let includedDates = (options.included_dates as string[] | undefined) ?? null
  if (Array.isArray(includedDates)) {
    includedDates = includedDates.map(String).filter(Boolean)
  }

  const overrides = (options.overrides as Record<string, unknown> | undefined) ?? {}
  const payFrequency = String(run.pay_frequency ?? 'semi_monthly')

  const empRows = await unsafe<Record<string, unknown>>(
    `SELECT e.id, e.pay_basis, e.pay_rate, COALESCE(e.pay_rate, p.min_hourly, 80) AS rate
     FROM employees e
     LEFT JOIN positions p ON p.id = e.position_id
     WHERE e.id = $1 AND e.branch_id = $2 LIMIT 1`,
    [employeeId, String(run.branch_id)],
  )
  const emp = empRows[0]
  if (!emp) throw new ValidationError('Employee not in this payroll branch')

  let row = await computeRegularPayslip(run, employeeId, payConfigFromRow(emp), payFrequency, includedDates)

  for (const field of ['sss_amount', 'philhealth_amount', 'pagibig_amount', 'tax_amount']) {
    if (field in overrides && overrides[field] !== '' && overrides[field] !== null) {
      row[field as keyof PayslipComputeRow] = Math.round(Number(overrides[field]) * 100) / 100 as never
    }
  }

  const cashAdvance = Math.round(Number(overrides.cash_advance ?? 0) * 100) / 100
  const loanDeduction =
    'loan_deduction' in overrides && overrides.loan_deduction !== ''
      ? Math.round(Number(overrides.loan_deduction) * 100) / 100
      : await applyPayrollDeduction(employeeId, runId, String(run.pay_date))
  const housing =
    'housing_deduction' in overrides && overrides.housing_deduction !== ''
      ? Math.round(Number(overrides.housing_deduction) * 100) / 100
      : await housingDeductionForEmployee(employeeId, payFrequency)

  if ('other_deductions' in overrides && overrides.other_deductions !== '') {
    row.other_deductions = Math.round(Number(overrides.other_deductions) * 100) / 100
    row = applyNetPay(row)
  } else {
    row = finalizePayslipAmounts(row, loanDeduction, cashAdvance, housing)
  }

  let existingId = await existingPayslipId(runId, employeeId)
  if (existingId) {
    await updatePayslipRow(existingId, row)
  } else {
    await insertPayslipRow(runId, employeeId, row)
    existingId = await existingPayslipId(runId, employeeId)
  }

  if (existingId) {
    await unsafeExec(
      `UPDATE payslips SET payment_status = 'ready', paid_at = NULL WHERE id = $1`,
      [existingId],
    )
  }

  await finalizeRun(runId, 1)

  return {
    payslip: existingId ? await getPayslip(existingId) : null,
    run: await getRun(runId),
  }
}

export async function updatePayslip(payslipId: string, data: Record<string, unknown>) {
  const existing = await getPayslip(payslipId)
  if (!existing) return null

  const run = await getRun(String(existing.payroll_run_id))
  if (!run || !['draft', 'processing', 'partially_paid'].includes(String(run.status ?? ''))) {
    throw new ValidationError('Cannot edit payslip on a closed payroll run')
  }
  if (String(existing.payment_status ?? '') === 'paid') {
    throw new ValidationError('Cannot edit a payslip that is already paid')
  }

  const row: PayslipComputeRow = {
    regular_hours: Number(existing.regular_hours ?? 0),
    overtime_hours: Number(existing.overtime_hours ?? 0),
    holiday_hours: Number(existing.holiday_hours ?? 0),
    basic_pay: Number(existing.basic_pay ?? 0),
    overtime_pay: Number(existing.overtime_pay ?? 0),
    holiday_pay: Number(existing.holiday_pay ?? 0),
    tips_amount: 0,
    benefits_amount: Number(existing.service_charge ?? 0),
    gross_pay: Number(existing.gross_pay ?? 0),
    sss_amount: Number(existing.sss_amount ?? 0),
    philhealth_amount: Number(existing.philhealth_amount ?? 0),
    pagibig_amount: Number(existing.pagibig_amount ?? 0),
    tax_amount: Number(existing.tax_amount ?? 0),
    other_deductions: Number(existing.other_deductions ?? 0),
    net_pay: Number(existing.net_pay ?? 0),
    adj_debits: 0,
  }

  for (const field of [
    'sss_amount',
    'philhealth_amount',
    'pagibig_amount',
    'tax_amount',
    'other_deductions',
    'gross_pay',
    'basic_pay',
    'regular_hours',
    'overtime_pay',
    'overtime_hours',
  ]) {
    if (field in data && data[field] !== '' && data[field] !== null) {
      row[field as keyof PayslipComputeRow] = Math.round(Number(data[field]) * 100) / 100 as never
    }
  }

  await updatePayslipRow(payslipId, applyNetPay(row))
  await finalizeRun(String(existing.payroll_run_id), 0)
  return getPayslip(payslipId)
}

export async function deferEmployees(
  runId: string,
  employeeIds: string[],
  note: string | null,
  userId: string | null,
) {
  const run = await getRun(runId)
  if (!run) throw new Error('Payroll run not found')
  assertRunOpenForDisbursement(run)

  let deferred = 0
  for (const rawId of employeeIds) {
    const employeeId = String(rawId)
    if (!employeeId) continue

    const payslipId = await existingPayslipId(runId, employeeId)
    if (payslipId) {
      const stRows = await unsafe<{ payment_status: string }>(
        `SELECT payment_status FROM payslips WHERE id = $1`,
        [payslipId],
      )
      const status = String(stRows[0]?.payment_status ?? 'ready')
      if (status === 'paid') {
        throw new ValidationError('Cannot defer an employee who is already paid')
      }
      await unsafeExec(`UPDATE payslips SET payment_status = 'deferred' WHERE id = $1`, [payslipId])
    } else {
      await unsafeExec(
        `INSERT INTO payroll_run_deferrals (payroll_run_id, employee_id, note, deferred_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (payroll_run_id, employee_id) DO UPDATE SET
           note = EXCLUDED.note, deferred_by = EXCLUDED.deferred_by, deferred_at = NOW()`,
        [runId, employeeId, note, userId],
      )
    }
    deferred++
  }

  await syncRunDisbursementStatus(runId)
  return { deferred, summary: await disbursementSummary(runId) }
}

export async function undeferEmployees(runId: string, employeeIds: string[]) {
  const run = await getRun(runId)
  if (!run) throw new Error('Payroll run not found')
  assertRunOpenForDisbursement(run)

  let restored = 0
  for (const rawId of employeeIds) {
    const employeeId = String(rawId)
    if (!employeeId) continue

    await unsafeExec(
      `DELETE FROM payroll_run_deferrals WHERE payroll_run_id = $1 AND employee_id = $2`,
      [runId, employeeId],
    )

    const payslipId = await existingPayslipId(runId, employeeId)
    if (payslipId) {
      await unsafeExec(
        `UPDATE payslips SET payment_status = 'ready' WHERE id = $1 AND payment_status = 'deferred'`,
        [payslipId],
      )
    }
    restored++
  }

  await syncRunDisbursementStatus(runId)
  return { restored, summary: await disbursementSummary(runId) }
}

export async function paySelectedEmployees(
  runId: string,
  employeeIds: string[],
  sendPayslipsFlag: boolean,
  userId: string | null,
) {
  const run = await getRun(runId)
  if (!run) throw new Error('Payroll run not found')
  assertRunOpenForDisbursement(run)

  let paid = 0
  const paidIds: string[] = []

  for (const rawId of employeeIds) {
    const employeeId = String(rawId)
    const payslipId = await existingPayslipId(runId, employeeId)
    if (!payslipId) {
      throw new ValidationError('Generate a payslip before paying this employee')
    }
    const stRows = await unsafe<{ payment_status: string }>(
      `SELECT payment_status FROM payslips WHERE id = $1`,
      [payslipId],
    )
    const status = String(stRows[0]?.payment_status ?? '')
    if (status !== 'ready') {
      throw new ValidationError('Only employees with ready payslips can be paid now')
    }
    await unsafeExec(
      `UPDATE payslips SET payment_status = 'paid', paid_at = NOW() WHERE id = $1`,
      [payslipId],
    )
    paidIds.push(payslipId)
    paid++
  }

  await syncRunDisbursementStatus(runId)

  const emailResult = { emailed: 0, skipped: 0, failed: 0 }
  if (sendPayslipsFlag && paidIds.length > 0) {
    const { sendPayslip: mailSendPayslip } = await import('./payroll-payslip-mail')
    for (const payslipId of paidIds) {
      const result = await mailSendPayslip(payslipId, userId) as Record<string, unknown>
      if (result.sent) emailResult.emailed++
      else if (result.skipped) emailResult.skipped++
      else emailResult.failed++
    }
  }

  return {
    paid,
    emailed: emailResult.emailed,
    skipped: emailResult.skipped,
    failed: emailResult.failed,
    summary: await disbursementSummary(runId),
  }
}

export async function disbursementSummary(runId: string) {
  const run = await getRun(runId)
  if (!run) throw new Error('Payroll run not found')
  return summarizeRosterEntries(await buildRosterEntries(runId, run))
}

export async function disbursementStatusFor(
  runId: string,
  employeeId: string,
  payslip: Record<string, unknown> | null,
): Promise<'pending' | 'ready' | 'paid' | 'deferred'> {
  if (payslip) {
    const st = String(payslip.payment_status ?? 'ready')
    if (['ready', 'paid', 'deferred'].includes(st)) return st as 'ready' | 'paid' | 'deferred'
    return 'ready'
  }
  if (await isDeferred(runId, employeeId)) return 'deferred'
  return 'pending'
}

export async function deferNoteFor(runId: string, employeeId: string): Promise<string | null> {
  const rows = await unsafe<{ note: string }>(
    `SELECT note FROM payroll_run_deferrals WHERE payroll_run_id = $1 AND employee_id = $2 LIMIT 1`,
    [runId, employeeId],
  )
  const note = rows[0]?.note
  return typeof note === 'string' && note !== '' ? note : null
}

export async function getRun(id: string) {
  const rows = await unsafe<Record<string, unknown>>(
    `SELECT pr.*, b.name AS branch_name FROM payroll_runs pr
     INNER JOIN branches b ON b.id = pr.branch_id WHERE pr.id = $1 LIMIT 1`,
    [id],
  )
  return rows[0] ?? null
}

export async function updateRun(id: string, data: Record<string, unknown>, actorUserId?: string | null) {
  const existing = await getRun(id)
  if (!existing) return null

  if (!data.status) return existing

  const status = String(data.status)
  const allowed = ['draft', 'processing', 'partially_paid', 'approved', 'paid', 'cancelled']
  if (!allowed.includes(status)) throw new ValidationError('Invalid status')

  assertRunStatusTransition(String(existing.status), status, id)

  if (status === 'approved') {
    const cntRows = await unsafe<{ c: string }>(
      `SELECT COUNT(*) AS c FROM payslips WHERE payroll_run_id = $1`,
      [id],
    )
    if (Number(cntRows[0]?.c ?? 0) === 0) {
      throw new ValidationError('Generate payslips before approving this run')
    }
  }

  let sql = `UPDATE payroll_runs SET status = $1`
  const params: SqlValue[] = [status]
  if (['approved', 'paid'].includes(status)) {
    sql += ', processed_at = NOW()'
  }
  sql += ` WHERE id = $${params.length + 1}`
  params.push(id)
  await unsafeExec(sql, params)

  const row = await getRun(id)
  if (row && status === 'paid' && data.send_payslips) {
    const { sendRunPayslips: mailSendRun } = await import('./payroll-payslip-mail')
    row.payslip_delivery = await mailSendRun(id, actorUserId ?? null)
  }

  return row
}

export async function getPayslip(id: string) {
  const rows = await unsafe<Record<string, unknown>>(
    `SELECT ps.*, e.emp_number, e.first_name, e.last_name, e.status AS employment_status,
      e.pay_basis, e.pay_rate,
      pos.title AS position_title, d.name AS department_name,
      pr.period_start, pr.period_end, pr.pay_date, pr.status AS run_status,
      pr.pay_frequency, pr.run_type
     FROM payslips ps
     INNER JOIN employees e ON e.id = ps.employee_id
     LEFT JOIN positions pos ON pos.id = e.position_id
     LEFT JOIN departments d ON d.id = e.department_id
     INNER JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
     WHERE ps.id = $1 LIMIT 1`,
    [id],
  )
  const row = rows[0]
  if (!row) return null

  const loanDeduction = await loanDeductionForRun(String(row.employee_id), String(row.payroll_run_id))
  const otherDeductions = Number(row.other_deductions ?? 0)
  row.loan_deduction = loanDeduction

  let cashAdvance = 0
  let tardiness = 0
  for (const adj of await payrollAdjustments.listAdjustments(String(row.employee_id), String(row.payroll_run_id))) {
    const type = String(adj.adj_type ?? '')
    const amount = Number(adj.amount ?? 0)
    if (type === 'advance') cashAdvance += amount
    else if (type === 'penalty') tardiness += amount
  }
  row.cash_advance = Math.round(cashAdvance * 100) / 100
  row.tardiness = Math.round(tardiness * 100) / 100

  let housing = await housingDeductionForEmployee(
    String(row.employee_id),
    String(row.pay_frequency ?? 'semi_monthly'),
  )
  if (housing <= 0) {
    housing = Math.max(0, Math.round((otherDeductions - loanDeduction - cashAdvance - tardiness) * 100) / 100)
  }
  row.housing_deduction = housing
  row.other_adjustments = Math.max(0, Math.round((otherDeductions - loanDeduction - housing) * 100) / 100)

  return row
}
