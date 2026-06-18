import type { BenefitsTab } from '../types/hrms'

export function formatBenefitMoney(v: string | number | undefined | null) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n) ? `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'
}

export const HR_BENEFITS_TABS: { id: BenefitsTab; label: string }[] = [
  { id: 'manage', label: 'Employee benefits' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'remittance', label: 'Remittance' },
]

export const COMPLIANCE_ISSUE_LABELS: Record<string, string> = {
  no_profile: 'No government profile saved',
  missing_sss_id: 'Missing SSS number',
  missing_philhealth_id: 'Missing PhilHealth number',
  missing_pagibig_id: 'Missing Pag-IBIG number',
  missing_tin: 'Missing TIN',
  invalid_sss_id: 'Invalid SSS number format',
  invalid_philhealth_id: 'Invalid PhilHealth number format',
  invalid_pagibig_id: 'Invalid Pag-IBIG number format',
  invalid_tin: 'Invalid TIN format',
}

export function frequencyLabel(freq: string) {
  return freq === 'per_payroll' ? 'Per payroll' : 'Monthly'
}
