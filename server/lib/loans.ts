import { getDb } from './db'
import { ValidationError } from './errors'
import { createNotification, userIdForEmployee } from './notifications'
import { unsafe, type SqlValue } from './sql'

const MIN_PRINCIPAL = 100

export async function list(employeeId?: string | null, branchId?: string | null) {
  const params: SqlValue[] = []
  let sql = `SELECT l.*, e.emp_number, e.first_name, e.last_name
    FROM employee_loans l INNER JOIN employees e ON e.id = l.employee_id WHERE 1=1`
  if (employeeId) {
    params.push(employeeId)
    sql += ` AND l.employee_id = $${params.length}`
  }
  if (branchId) {
    params.push(branchId)
    sql += ` AND e.branch_id = $${params.length}`
  }
  sql += ' ORDER BY l.created_at DESC'
  return unsafe(sql, params)
}

export async function get(id: string) {
  const db = getDb()
  const rows = await db`
    SELECT l.*, e.emp_number, e.first_name, e.last_name
    FROM employee_loans l INNER JOIN employees e ON e.id = l.employee_id
    WHERE l.id = ${id} LIMIT 1
  `
  return rows[0] ?? null
}

export async function payments(loanId: string) {
  const db = getDb()
  return db`SELECT * FROM loan_payments WHERE loan_id = ${loanId} ORDER BY paid_on DESC`
}

function resolveRepayment(data: Record<string, unknown>) {
  const schedule = String(data.repayment_schedule ?? 'semi_monthly')
  if (!['semi_monthly', 'one_month'].includes(schedule)) {
    throw new ValidationError('repayment_schedule must be semi_monthly or one_month')
  }
  if (schedule === 'one_month') {
    return { repayment_schedule: 'one_month', term_duration: 1, pay_periods: 2 }
  }
  const duration = Number(data.term_duration ?? 2)
  if (duration < 1 || duration > 24) {
    throw new ValidationError('term_duration must be between 1 and 24 semi-monthly cutoffs')
  }
  return { repayment_schedule: 'semi_monthly', term_duration: duration, pay_periods: duration }
}

export async function apply(data: Record<string, unknown>) {
  const principal = Math.round(Number(data.principal ?? 0) * 100) / 100
  if (principal < MIN_PRINCIPAL) throw new ValidationError(`Minimum amount is ₱${MIN_PRINCIPAL}`)
  const loanType = String(data.loan_type ?? 'salary')
  if (!['salary', 'cash_advance'].includes(loanType)) {
    throw new ValidationError('loan_type must be salary or cash_advance')
  }
  const repayment = resolveRepayment(data)
  const monthly = Math.round((principal / repayment.pay_periods) * 100) / 100
  const db = getDb()
  const [row] = await db`
    INSERT INTO employee_loans (employee_id, loan_type, principal, balance, term_months,
      repayment_schedule, term_duration, monthly_deduction, purpose, status)
    VALUES (${String(data.employee_id)}, ${loanType}, ${principal}, ${principal},
      ${repayment.pay_periods}, ${repayment.repayment_schedule}, ${repayment.term_duration},
      ${monthly}, ${data.purpose ? String(data.purpose).trim() : null}, 'pending')
    RETURNING id
  `
  return get(String(row.id))
}

async function notifyLoanDecision(loan: Record<string, unknown>, status: string) {
  const uid = await userIdForEmployee(String(loan.employee_id))
  if (!uid) return
  const amount = Number(loan.principal).toFixed(2)
  const schedule = String(loan.repayment_schedule ?? 'semi_monthly')
  const term =
    schedule === 'one_month'
      ? 'Term: 1 month (2 cutoffs).'
      : `Term: ${loan.term_duration ?? loan.term_months} semi-monthly cutoff(s).`
  if (status === 'approved') {
    await createNotification(
      uid,
      'loan_approved',
      'Loan approved',
      `Your loan application for ₱${amount} was approved. ${term} Deduction per cutoff: ₱${loan.monthly_deduction}.`,
      String(loan.id),
      '/loans',
    )
    return
  }
  await createNotification(uid, 'loan_rejected', 'Loan declined', `Your loan application for ₱${amount} was declined.`, String(loan.id), '/loans')
}

export async function review(id: string, status: string, reviewerUserId: string) {
  const loan = await get(id)
  if (!loan || String(loan.status) !== 'pending') return null
  if (!['approved', 'rejected'].includes(status)) throw new ValidationError('status must be approved or rejected')
  const newStatus = status === 'approved' ? 'active' : 'rejected'
  const db = getDb()
  await db`
    UPDATE employee_loans SET status = ${newStatus}, approved_by = ${reviewerUserId}, approved_at = NOW()
    WHERE id = ${id}
  `
  const row = await get(id)
  if (row) await notifyLoanDecision(row, status)
  return row
}

export async function recordPayment(loanId: string, data: Record<string, unknown>) {
  const loan = await get(loanId)
  if (!loan || !['active', 'approved'].includes(String(loan.status))) return null
  const amount = Math.round(Number(data.amount ?? 0) * 100) / 100
  if (amount <= 0) throw new ValidationError('amount must be positive')
  const paidOn = String(data.paid_on ?? new Date().toISOString().slice(0, 10))
  const db = getDb()
  let paymentRow: Record<string, unknown> | undefined
  await db.begin(async (tx) => {
    const [inserted] = await tx`
      INSERT INTO loan_payments (loan_id, amount, paid_on, notes)
      VALUES (${loanId}, ${amount}, ${paidOn}, ${data.notes ? String(data.notes) : null})
      RETURNING *
    `
    paymentRow = inserted
    const newBalance = Math.max(0, Math.round((Number(loan.balance) - amount) * 100) / 100)
    await tx`
      UPDATE employee_loans SET balance = ${newBalance}, status = ${newBalance <= 0 ? 'paid' : 'active'}
      WHERE id = ${loanId}
    `
  })
  return paymentRow ?? null
}

export async function reversePayrollDeductions(payrollRunId: string) {
  const note = `Payroll deduction (run ${payrollRunId})`
  const db = getDb()
  const payments = await db`SELECT id, loan_id, amount FROM loan_payments WHERE notes = ${note}`
  for (const payment of payments) {
    const loanRows = await db`SELECT balance, status FROM employee_loans WHERE id = ${String(payment.loan_id)} LIMIT 1`
    const loan = loanRows[0]
    if (!loan) continue
    const newBalance = Math.round((Number(loan.balance) + Number(payment.amount)) * 100) / 100
    await db`
      UPDATE employee_loans SET balance = ${newBalance}, status = ${newBalance > 0 ? 'active' : String(loan.status)}
      WHERE id = ${String(payment.loan_id)}
    `
    await db`DELETE FROM loan_payments WHERE id = ${String(payment.id)}`
  }
}

export async function estimatedPayrollDeduction(employeeId: string): Promise<number> {
  const db = getDb()
  const rows = await db`
    SELECT balance, monthly_deduction FROM employee_loans
    WHERE employee_id = ${employeeId} AND status = 'active' AND balance > 0
  `
  let total = 0
  for (const loan of rows) {
    total += Math.min(Number(loan.monthly_deduction), Number(loan.balance))
  }
  return Math.round(total * 100) / 100
}

export async function applyPayrollDeduction(employeeId: string, payrollRunId: string, payDate: string): Promise<number> {
  const db = getDb()
  const rows = await db`
    SELECT id, balance, monthly_deduction FROM employee_loans
    WHERE employee_id = ${employeeId} AND status = 'active' AND balance > 0
  `
  const note = `Payroll deduction (run ${payrollRunId})`
  let total = 0
  for (const loan of rows) {
    const deduct = Math.min(Number(loan.monthly_deduction), Number(loan.balance))
    if (deduct <= 0) continue
    const exists = await db`
      SELECT id FROM loan_payments WHERE loan_id = ${String(loan.id)} AND notes = ${note} LIMIT 1
    `
    if (exists[0]) continue
    await db`
      INSERT INTO loan_payments (loan_id, amount, paid_on, notes)
      VALUES (${String(loan.id)}, ${deduct}, ${payDate}, ${note})
    `
    const newBalance = Math.max(0, Math.round((Number(loan.balance) - deduct) * 100) / 100)
    await db`
      UPDATE employee_loans SET balance = ${newBalance}, status = ${newBalance <= 0 ? 'paid' : 'active'}
      WHERE id = ${String(loan.id)}
    `
    total += deduct
  }
  return Math.round(total * 100) / 100
}
