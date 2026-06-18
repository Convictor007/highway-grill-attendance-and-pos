import type { BenefitsTab, GovernmentAgency } from '../types/hrms'

export function formatBenefitMoney(v: string | number | undefined | null) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n) ? `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'
}

export const BENEFITS_TABS: { id: BenefitsTab; label: string; description: string }[] = [
  { id: 'overview', label: 'Overview', description: 'Summary of all contributions and allowances' },
  { id: 'sss', label: 'SSS', description: 'Social Security System' },
  { id: 'philhealth', label: 'PhilHealth', description: 'Philippine Health Insurance' },
  { id: 'pagibig', label: 'Pag-IBIG', description: 'Home Development Mutual Fund (HDMF)' },
  { id: 'tax', label: 'Withholding tax', description: 'BIR income tax withheld' },
  { id: 'allowances', label: 'Allowances', description: 'Meal, transport, and other benefits' },
]

export const HR_BENEFITS_TABS: { id: BenefitsTab; label: string; description: string }[] = [
  ...BENEFITS_TABS,
  { id: 'compliance', label: 'Compliance', description: 'Missing IDs and enrollment gaps' },
  { id: 'remittance', label: 'Remittance', description: 'Monthly government contribution summary' },
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

export const GOVERNMENT_AGENCY_HINTS: Record<GovernmentAgency, string> = {
  sss: 'Employee share is computed from monthly compensation using the current SSS contribution table.',
  philhealth: 'Employee share is 2.5% of monthly basic salary (floor ₱10,000, ceiling ₱100,000).',
  pagibig: 'Employee share is 1% (≤₱1,500 salary) or 2% capped at ₱200 for higher salaries.',
}

export function frequencyLabel(freq: string) {
  return freq === 'per_payroll' ? 'Per payroll' : 'Monthly'
}
