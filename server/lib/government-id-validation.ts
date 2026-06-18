import { ValidationError } from './errors'

export type GovernmentProfileInput = {
  sss_number?: string | null
  philhealth_number?: string | null
  pagibig_number?: string | null
  tin?: string | null
  sss_enrolled?: boolean
  philhealth_enrolled?: boolean
  pagibig_enrolled?: boolean
}

export type ComplianceIssueCode =
  | 'missing_sss_id'
  | 'missing_philhealth_id'
  | 'missing_pagibig_id'
  | 'missing_tin'
  | 'invalid_sss_id'
  | 'invalid_philhealth_id'
  | 'invalid_pagibig_id'
  | 'invalid_tin'
  | 'no_profile'

function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

export function normalizeSssNumber(value: string) {
  const d = digitsOnly(value)
  if (d.length !== 10) return value.trim()
  return `${d.slice(0, 2)}-${d.slice(2, 9)}-${d.slice(9)}`
}

export function normalizePhilhealthNumber(value: string) {
  const d = digitsOnly(value)
  if (d.length !== 12) return value.trim()
  return `${d.slice(0, 2)}-${d.slice(2, 11)}-${d.slice(11)}`
}

export function normalizePagibigNumber(value: string) {
  const d = digitsOnly(value)
  if (d.length !== 12) return value.trim()
  return `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8)}`
}

export function normalizeTin(value: string) {
  const d = digitsOnly(value)
  if (d.length === 9) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  if (d.length === 12) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 9)}-${d.slice(9)}`
  return value.trim()
}

function isValidSss(value: string | null | undefined) {
  if (!value?.trim()) return false
  return digitsOnly(value).length === 10
}

function isValidPhilhealth(value: string | null | undefined) {
  if (!value?.trim()) return false
  return digitsOnly(value).length === 12
}

function isValidPagibig(value: string | null | undefined) {
  if (!value?.trim()) return false
  return digitsOnly(value).length === 12
}

function isValidTin(value: string | null | undefined) {
  if (!value?.trim()) return false
  const len = digitsOnly(value).length
  return len === 9 || len === 12
}

export function profileComplianceIssues(profile: GovernmentProfileInput & { has_row?: boolean }) {
  const issues: ComplianceIssueCode[] = []
  if (!profile.has_row) issues.push('no_profile')

  if (profile.sss_enrolled !== false) {
    if (!profile.sss_number?.trim()) issues.push('missing_sss_id')
    else if (!isValidSss(profile.sss_number)) issues.push('invalid_sss_id')
  }
  if (profile.philhealth_enrolled !== false) {
    if (!profile.philhealth_number?.trim()) issues.push('missing_philhealth_id')
    else if (!isValidPhilhealth(profile.philhealth_number)) issues.push('invalid_philhealth_id')
  }
  if (profile.pagibig_enrolled !== false) {
    if (!profile.pagibig_number?.trim()) issues.push('missing_pagibig_id')
    else if (!isValidPagibig(profile.pagibig_number)) issues.push('invalid_pagibig_id')
  }
  if (!profile.tin?.trim()) issues.push('missing_tin')
  else if (!isValidTin(profile.tin)) issues.push('invalid_tin')

  return issues
}

export function validateGovernmentProfileInput(data: GovernmentProfileInput) {
  const errors: string[] = []
  if (data.sss_enrolled !== false && data.sss_number?.trim() && !isValidSss(data.sss_number)) {
    errors.push('SSS number must be 10 digits (e.g. 34-1234567-8)')
  }
  if (data.philhealth_enrolled !== false && data.philhealth_number?.trim() && !isValidPhilhealth(data.philhealth_number)) {
    errors.push('PhilHealth number must be 12 digits')
  }
  if (data.pagibig_enrolled !== false && data.pagibig_number?.trim() && !isValidPagibig(data.pagibig_number)) {
    errors.push('Pag-IBIG number must be 12 digits')
  }
  if (data.tin?.trim() && !isValidTin(data.tin)) {
    errors.push('TIN must be 9 or 12 digits')
  }
  if (data.sss_enrolled !== false && !data.sss_number?.trim()) {
    errors.push('SSS number is required when SSS enrollment is enabled')
  }
  if (data.philhealth_enrolled !== false && !data.philhealth_number?.trim()) {
    errors.push('PhilHealth number is required when PhilHealth enrollment is enabled')
  }
  if (data.pagibig_enrolled !== false && !data.pagibig_number?.trim()) {
    errors.push('Pag-IBIG number is required when Pag-IBIG enrollment is enabled')
  }
  if (errors.length) throw new ValidationError(errors.join(' '))
}

export function normalizeGovernmentProfileFields(data: GovernmentProfileInput) {
  return {
    sss_number: data.sss_number?.trim() ? normalizeSssNumber(data.sss_number) : null,
    philhealth_number: data.philhealth_number?.trim() ? normalizePhilhealthNumber(data.philhealth_number) : null,
    pagibig_number: data.pagibig_number?.trim() ? normalizePagibigNumber(data.pagibig_number) : null,
    tin: data.tin?.trim() ? normalizeTin(data.tin) : null,
  }
}
