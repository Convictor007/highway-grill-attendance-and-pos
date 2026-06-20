export type RepaymentSchedule = 'semi_monthly' | 'one_month'

export const LOAN_MIN_AMOUNT = 100

/** Payroll deduction periods (semi-monthly cutoffs). */
export function payPeriods(schedule: RepaymentSchedule, duration: number): number {
  if (schedule === 'one_month') {
    return 2
  }
  return Math.max(1, Math.min(24, Math.floor(duration)))
}

export function deductionPerPeriod(principal: number, schedule: RepaymentSchedule, duration: number): number {
  const periods = payPeriods(schedule, duration)
  return Math.round((principal / periods) * 100) / 100
}

export function repaymentTermSummary(schedule: RepaymentSchedule, duration: number): string {
  if (schedule === 'one_month') {
    return '1 month (2 semi-monthly cutoffs)'
  }
  const n = payPeriods(schedule, duration)
  return n === 1 ? '1 semi-monthly cutoff' : `${n} semi-monthly cutoffs`
}
