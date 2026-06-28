import { normalizeShiftDate } from './datetime'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const

export function formatPayslipMoney(value: string | number | undefined | null): string {
  if (value == null || value === '') return '0.00'
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatPayslipQty(value: string | number | undefined | null): string {
  if (value == null || value === '') return '0.00'
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** e.g. JUN 16 – 30 — same date normalization as the payroll run header. */
export function formatPayslipPeriod(periodStart?: unknown, periodEnd?: unknown): string {
  const start = normalizeShiftDate(periodStart)
  const end = normalizeShiftDate(periodEnd)
  if (!start || !end) return '—'
  const [, sm, sd] = start.split('-').map(Number)
  const [, em, ed] = end.split('-').map(Number)
  const startMonth = MONTHS[sm - 1]
  const endMonth = MONTHS[em - 1]
  if (!startMonth || !endMonth) return '—'
  if (startMonth === endMonth) {
    return `${startMonth} ${sd} – ${ed}`
  }
  return `${startMonth} ${sd} – ${endMonth} ${ed}`
}

export function payslipTitle(runType?: string, payFrequency?: string): string {
  if (runType === '13th_month') return 'PAYSLIP - 13TH MONTH PAY'
  if (payFrequency === 'monthly') return 'PAYSLIP - MONTHLY PAYROLL'
  return 'PAYSLIP - SEMI-MONTHLY PAYROLL'
}

export function employmentStatusLabel(status?: string | null): string {
  if (!status) return 'N/A'
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
