const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const

export function formatPayslipMoney(value: string | number | undefined | null): string {
  if (value == null || value === '') return '0.00'
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatPayslipQty(value: string | number | undefined | null): string {
  if (value == null || value === '') return '0.00'
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Parse a date that may be a plain "YYYY-MM-DD" or a full ISO timestamp
 * (e.g. "2026-06-16T00:00:00.000Z" returned by the API for DATE columns).
 * Uses the calendar-date part only so timezone never shifts the day.
 */
function parsePeriodDate(value?: string): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  if (!match) {
    const fallback = new Date(value)
    return Number.isNaN(fallback.getTime()) ? null : fallback
  }
  const [, y, m, d] = match
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return Number.isNaN(date.getTime()) ? null : date
}

/** e.g. JUN 1 – 15 */
export function formatPayslipPeriod(periodStart?: string, periodEnd?: string): string {
  const start = parsePeriodDate(periodStart)
  const end = parsePeriodDate(periodEnd)
  if (!start || !end) return '—'
  const sm = MONTHS[start.getMonth()]
  const em = MONTHS[end.getMonth()]
  if (sm === em) {
    return `${sm} ${start.getDate()} – ${end.getDate()}`
  }
  return `${sm} ${start.getDate()} – ${em} ${end.getDate()}`
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
