export function forPayPeriod(periodGross: number, payFrequency = 'semi_monthly') {
  const monthlyEquiv = payFrequency === 'monthly' ? periodGross : periodGross * 2
  const monthly = monthlyEmployeeShares(monthlyEquiv)
  const divisor = payFrequency === 'monthly' ? 1 : 2
  return {
    sss: Math.round((monthly.sss / divisor) * 100) / 100,
    philhealth: Math.round((monthly.philhealth / divisor) * 100) / 100,
    pagibig: Math.round((monthly.pagibig / divisor) * 100) / 100,
    tax: Math.round((monthly.tax / divisor) * 100) / 100,
  }
}

export function monthlyEmployeeShares(monthlyCompensation: number) {
  const taxable = Math.max(0, monthlyCompensation)
  return {
    sss: sssEmployeeShare(taxable),
    philhealth: philhealthEmployeeShare(taxable),
    pagibig: pagibigEmployeeShare(taxable),
    tax: birMonthlyWithholding(taxable),
  }
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
