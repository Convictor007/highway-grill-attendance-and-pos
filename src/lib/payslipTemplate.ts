import type { Payslip } from '../types/hrms'
import {
  employmentStatusLabel,
  formatPayslipMoney,
  formatPayslipPeriod,
  formatPayslipQty,
  payslipTitle,
} from './payslipFormat'

export type PayslipTemplateData = {
  companyName: string
  title: string
  periodLabel: string
  basicPay: number
  overtime: number
  earningsSubtotal: number
  employeeName: string
  status: string
  position: string
  eventDuty: number
  allowance: number
  grossPay: number
  workType: string
  days: string
  basePayRate: number
  payBasis: string
  adjustmentsLabel: string
  adjustmentsAmount: number
  deductions: {
    whTax: number
    sss: number
    sssLoan: number
    philhealth: number
    hdmf: number
  }
  tardiness: number
  outstandingLoan: number
  ca: number
  hsng: number
  less: {
    ca: number
    loan: number
    hsng: number
  }
  totalLess: number
  netPay: number
}

function num(value: string | number | undefined | null): number {
  if (value == null || value === '') return 0
  return Number(value)
}

export function buildPayslipTemplateData(detail: Payslip, companyName = 'Highway Grill'): PayslipTemplateData {
  const employeeName =
    detail.first_name || detail.last_name
      ? `${detail.first_name ?? ''} ${detail.last_name ?? ''}`.trim()
      : '—'

  const basicPay = num(detail.basic_pay)
  const overtime = num(detail.overtime_pay)
  const eventDuty = num(detail.holiday_pay)
  const allowance = num(detail.service_charge)
  const grossPay = num(detail.gross_pay)

  const whTax = num(detail.tax_amount)
  const sss = num(detail.sss_amount)
  const philhealth = num(detail.philhealth_amount)
  const hdmf = num(detail.pagibig_amount)
  const loan = num(detail.loan_deduction)
  const ca = num(detail.cash_advance)
  const hsng = num(detail.housing_deduction)
  const tardiness = num(detail.tardiness)

  const regularHours = num(detail.regular_hours)
  const days =
    detail.pay_basis === 'daily'
      ? regularHours > 0
        ? formatPayslipQty(regularHours > 15 ? regularHours / 8 : regularHours)
        : '0.00'
      : regularHours > 0
        ? formatPayslipQty(regularHours / 8)
        : '0.00'

  const basePayRate = num(detail.pay_rate)
  const periodStart = detail.period_start ?? ''
  const periodEnd = detail.period_end ?? ''
  const periodLabel = formatPayslipPeriod(periodStart, periodEnd)

  const miscOther = Math.max(0, num(detail.other_adjustments) - ca - tardiness - hsng)
  const totalLess = whTax + sss + philhealth + hdmf + loan + ca + hsng + tardiness + miscOther

  return {
    companyName,
    title: payslipTitle(detail.run_type, detail.pay_frequency),
    periodLabel,
    basicPay,
    overtime,
    earningsSubtotal: round2(basicPay + overtime),
    employeeName,
    status: employmentStatusLabel(detail.employment_status),
    position: detail.position_title?.trim() || '—',
    eventDuty,
    allowance,
    grossPay,
    workType: 'REGULAR',
    days,
    basePayRate,
    payBasis: detail.pay_basis ?? 'daily',
    adjustmentsLabel: miscOther > 0 ? 'OTHERS' : 'OTHERS',
    adjustmentsAmount: miscOther,
    deductions: {
      whTax,
      sss,
      sssLoan: 0,
      philhealth,
      hdmf,
    },
    tardiness,
    outstandingLoan: loan,
    ca,
    hsng,
    less: { ca, loan, hsng },
    totalLess: round2(totalLess),
    netPay: num(detail.net_pay),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function formatMoney(value: number): string {
  return formatPayslipMoney(value)
}
