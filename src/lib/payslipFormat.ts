const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const

export function formatPayslipMoney(value: string | number | undefined | null): string {
  if (value == null || value === '') return '0.00'
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatPayslipQty(value: string | number | undefined | null): string {
  if (value == null || value === '') return '0.00'
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** e.g. JUN 1 – 15 */
export function formatPayslipPeriod(periodStart?: string, periodEnd?: string): string {
  if (!periodStart || !periodEnd) return '—'
  const start = new Date(`${periodStart}T00:00:00`)
  const end = new Date(`${periodEnd}T00:00:00`)
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
