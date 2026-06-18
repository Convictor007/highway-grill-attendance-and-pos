export function monthlyEmployeeShares(monthlyCompensation: number) {
  const taxable = Math.max(0, monthlyCompensation)
  return {
    sss: sssEmployeeShare(taxable),
    philhealth: philhealthEmployeeShare(taxable),
    pagibig: pagibigEmployeeShare(taxable),
    tax: birMonthlyWithholding(taxable),
  }
}

export function monthlyEmployerShares(monthlyCompensation: number) {
  const taxable = Math.max(0, monthlyCompensation)
  return {
    sss: sssEmployerShare(taxable),
    philhealth: philhealthEmployerShare(taxable),
    pagibig: pagibigEmployerShare(taxable),
  }
}

export type DeductionMode = 'auto' | 'manual'

export type StatutoryDeductionConfig = {
  sss_enrolled?: boolean
  philhealth_enrolled?: boolean
  pagibig_enrolled?: boolean
  tax_enrolled?: boolean
  sss_deduction_mode?: DeductionMode
  sss_monthly_amount?: number | null
  philhealth_deduction_mode?: DeductionMode
  philhealth_monthly_amount?: number | null
  pagibig_deduction_mode?: DeductionMode
  pagibig_monthly_amount?: number | null
  tax_deduction_mode?: DeductionMode
  tax_monthly_amount?: number | null
}

/** @deprecated use StatutoryDeductionConfig */
export type EnrollmentFlags = StatutoryDeductionConfig

function roundMoney(n: number) {
  return Math.round(n * 100) / 100
}

function resolveDeduction(
  enrolled: boolean,
  mode: DeductionMode | undefined,
  manualMonthly: number | null | undefined,
  autoMonthly: number,
  divisor: number,
) {
  if (!enrolled) return 0
  if (mode === 'manual' && manualMonthly != null && Number.isFinite(manualMonthly)) {
    return roundMoney(manualMonthly / divisor)
  }
  return roundMoney(autoMonthly / divisor)
}

export function effectiveDeductionsFromMonthly(
  monthlyCompensation: number,
  payFrequency: 'monthly' | 'semi_monthly',
  config: StatutoryDeductionConfig = {},
) {
  const autoMonthly = monthlyEmployeeShares(monthlyCompensation)
  const divisor = payFrequency === 'monthly' ? 1 : 2
  return {
    sss: resolveDeduction(
      config.sss_enrolled !== false,
      config.sss_deduction_mode,
      config.sss_monthly_amount,
      autoMonthly.sss,
      divisor,
    ),
    philhealth: resolveDeduction(
      config.philhealth_enrolled !== false,
      config.philhealth_deduction_mode,
      config.philhealth_monthly_amount,
      autoMonthly.philhealth,
      divisor,
    ),
    pagibig: resolveDeduction(
      config.pagibig_enrolled !== false,
      config.pagibig_deduction_mode,
      config.pagibig_monthly_amount,
      autoMonthly.pagibig,
      divisor,
    ),
    tax: resolveDeduction(
      config.tax_enrolled !== false,
      config.tax_deduction_mode,
      config.tax_monthly_amount,
      autoMonthly.tax,
      divisor,
    ),
  }
}

export function forPayPeriod(
  periodGross: number,
  payFrequency = 'semi_monthly',
  config: StatutoryDeductionConfig = {},
) {
  const monthlyEquiv = payFrequency === 'monthly' ? periodGross : periodGross * 2
  return effectiveDeductionsFromMonthly(
    monthlyEquiv,
    payFrequency === 'monthly' ? 'monthly' : 'semi_monthly',
    config,
  )
}

export function sssEmployerShare(monthlySalary: number) {
  if (monthlySalary < 1000) return 0
  const msc = Math.min(30000, Math.max(4000, Math.ceil(monthlySalary / 500) * 500))
  return Math.round(msc * 0.095 * 100) / 100
}

export function philhealthEmployerShare(monthlySalary: number) {
  return philhealthEmployeeShare(monthlySalary)
}

export function pagibigEmployerShare(monthlySalary: number) {
  return pagibigEmployeeShare(monthlySalary)
}

export function sssEmployeeShare(monthlySalary: number) {
  if (monthlySalary < 1000) return 0
  const msc = Math.min(30000, Math.max(4000, Math.ceil(monthlySalary / 500) * 500))
  return Math.round(msc * 0.045 * 100) / 100
}

export function philhealthEmployeeShare(monthlySalary: number) {
  const base = Math.max(10000, Math.min(100000, monthlySalary))
  return Math.round(base * 0.025 * 100) / 100
}

export function pagibigEmployeeShare(monthlySalary: number) {
  if (monthlySalary <= 0) return 0
  if (monthlySalary <= 1500) return Math.round(monthlySalary * 0.01 * 100) / 100
  return Math.min(200, Math.round(monthlySalary * 0.02 * 100) / 100)
}

export function birMonthlyWithholding(monthlyTaxable: number) {
  if (monthlyTaxable <= 20833) return 0
  if (monthlyTaxable <= 33332) return Math.round((monthlyTaxable - 20833) * 0.2 * 100) / 100
  if (monthlyTaxable <= 66666) return Math.round((2500 + (monthlyTaxable - 33332) * 0.25) * 100) / 100
  if (monthlyTaxable <= 166666) return Math.round((10833 + (monthlyTaxable - 66666) * 0.3) * 100) / 100
  if (monthlyTaxable <= 666666) return Math.round((40833.33 + (monthlyTaxable - 166666) * 0.32) * 100) / 100
  return Math.round((200833.33 + (monthlyTaxable - 666666) * 0.35) * 100) / 100
}

export function thirteenthMonthTax(thirteenthAmount: number) {
  if (thirteenthAmount <= 90000) return 0
  return Math.round((thirteenthAmount - 90000) * 0.05 * 100) / 100
}

export function profileToDeductionConfig(profile: Record<string, unknown>): StatutoryDeductionConfig {
  const mode = (v: unknown): DeductionMode => (v === 'manual' ? 'manual' : 'auto')
  const amt = (v: unknown): number | null => {
    if (v == null || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return {
    sss_enrolled: profile.sss_enrolled !== false,
    philhealth_enrolled: profile.philhealth_enrolled !== false,
    pagibig_enrolled: profile.pagibig_enrolled !== false,
    tax_enrolled: profile.tax_enrolled !== false,
    sss_deduction_mode: mode(profile.sss_deduction_mode),
    sss_monthly_amount: amt(profile.sss_monthly_amount),
    philhealth_deduction_mode: mode(profile.philhealth_deduction_mode),
    philhealth_monthly_amount: amt(profile.philhealth_monthly_amount),
    pagibig_deduction_mode: mode(profile.pagibig_deduction_mode),
    pagibig_monthly_amount: amt(profile.pagibig_monthly_amount),
    tax_deduction_mode: mode(profile.tax_deduction_mode),
    tax_monthly_amount: amt(profile.tax_monthly_amount),
  }
}
