import { existsSync, readFileSync, readdirSync } from 'fs'
import path from 'path'

const COMPANY = 'Highway Grill'

function num(value: unknown): number {
  return Math.round(Number(value ?? 0) * 100) / 100
}

function money(value: unknown): string {
  return num(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Parse a period bound that may be a plain "YYYY-MM-DD", a full ISO timestamp
 * ("2026-06-16T00:00:00.000Z"), or a stringified Date ("Tue Jun 16 2026 ...").
 */
function parsePeriodBound(value: string): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
  const fallback = new Date(value)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

function formatPeriod(start: string, end: string): string {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const s = parsePeriodBound(start)
  const e = parsePeriodBound(end)
  if (!s || !e) return '—'
  const sm = months[s.getMonth()]
  const em = months[e.getMonth()]
  if (sm === em) return `${sm} ${s.getDate()} – ${e.getDate()}`
  return `${sm} ${s.getDate()} – ${em} ${e.getDate()}`
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function blank(value: number): string {
  return value > 0 ? money(value) : ''
}

function kvRows(rows: [string, string, boolean?, string?][]): string {
  return rows
    .map(([label, value, dotted, cls]) => {
      const valueClass = `kv-val${dotted ? ' dotted' : ''}${cls ? ` ${cls}` : ''}`
      const labelClass = `kv-label${cls === 'sub' ? ' sub' : ''}${cls === 'strong' ? ' strong' : ''}`
      const display = value !== '' ? value : '&nbsp;'
      return `<tr><td class="${labelClass}">${esc(label)}</td><td class="${valueClass}">${display}</td></tr>`
    })
    .join('')
}

function watermarkImgTag(): string {
  const candidates = [
    path.join(process.cwd(), '..', 'src', 'assets', 'HG_logo.png'),
    path.join(process.cwd(), 'assets', 'HG_logo.png'),
    path.join(process.cwd(), 'public', 'HG_logo.png'),
  ]
  const assetsDir = path.join(process.cwd(), 'public', 'assets')
  if (existsSync(assetsDir)) {
    const match = readdirSync(assetsDir).find((f) => f.includes('HG_logo') || f.startsWith('HGlogo'))
    if (match) candidates.unshift(path.join(assetsDir, match))
  }

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue
    const data = readFileSync(filePath).toString('base64')
    const mime = filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') ? 'image/jpeg' : 'image/png'
    return `<img class="watermark-img" src="data:${mime};base64,${data}" alt="" width="280" height="280" />`
  }
  return ''
}

function styles(): string {
  return `<style>
    *{box-sizing:border-box}
    body{font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#1c1410;margin:16px}
    .tpl{position:relative;max-width:720px;margin:0 auto;border:2px solid #e8a317;padding:14px 16px;overflow:hidden}
    .watermark{position:absolute;top:0;left:0;width:100%;height:100%;z-index:0}
    .wm-table{width:100%;height:520px;border-collapse:collapse}
    .wm-table td{text-align:center;vertical-align:middle}
    .watermark-img{width:280px;height:280px;opacity:.02}
    .brand,.top-sum,.emp,.main-grid,.net,.received{position:relative;z-index:1}
    .brand{text-align:center;margin-bottom:12px}
    .company-name{margin:0 0 10px;font-size:13px;font-weight:700;color:#7a1528;letter-spacing:.02em}
    .title-block{width:100%;text-align:center;margin-top:2px}
    .banner-wrap{text-align:center;margin-bottom:6px}
    .banner{display:inline-block;background:#7a1528;color:#f5d78e;font-weight:700;font-size:9px;letter-spacing:.08em;text-transform:uppercase;padding:6px 20px;border-radius:20px;border:2px solid #e8a317;line-height:1.3}
    .period{margin:0;font-size:10px;font-weight:600;letter-spacing:.04em;color:#1c1410}
    .period strong{font-weight:700}
    .top-sum{margin:10px 0 8px;padding-bottom:6px;border-bottom:1px solid #b8a898}
    .top-sum td{padding:2px 6px;vertical-align:baseline}
    .top-sum .lbl{font-weight:700;white-space:nowrap}
    .top-sum .gap{width:10px}
    .top-sum .total{font-size:12px;font-weight:700}
    .emp{margin-bottom:10px;font-size:10px}
    .emp td{padding:2px 4px 2px 0;vertical-align:top}
    .main-grid{border:1px solid #e8a317;border-collapse:collapse;margin-bottom:8px}
    .main-grid .col{vertical-align:top;padding:6px;border-right:1px solid #e8a317}
    .main-grid .col-last{border-right:none}
    .tbl{border-collapse:collapse;font-size:9px;margin-bottom:6px}
    .tbl th{background:#7a1528;color:#f5d78e;padding:4px 3px;text-align:center;font-size:8px;font-weight:700}
    .tbl td{padding:4px 3px;border-bottom:1px dotted #b8a898}
    .tbl .center{text-align:center}
    .num{text-align:right;font-weight:600;white-space:nowrap;padding-right:2px}
    .num.dotted{border-bottom:1px dotted #888}
    .kv{border-collapse:collapse;font-size:9px;margin-top:4px}
    .kv td{padding:3px 0;vertical-align:bottom}
    .kv-label{text-align:left;padding-right:6px;white-space:nowrap}
    .kv-label.sub{padding-left:8px}
    .kv-label.strong{font-weight:700}
    .kv-val{text-align:right;font-weight:600;white-space:nowrap;width:58px}
    .kv-val.dotted{border-bottom:1px dotted #888;min-height:12px}
    .kv-val.strong{font-weight:700}
    .less-head{font-weight:700;margin:8px 0 2px;font-size:9px}
    .net{background:#edf6e4;border:1px solid #9bc47a;margin-top:10px}
    .net td{padding:8px 10px;font-size:12px;font-weight:700}
    .net-amt{font-size:14px}
    .received{margin-top:16px}
    .sign-line{border-bottom:1px solid #222;height:22px;margin-top:6px;max-width:240px}
  </style>`
}

export function buildPayslipData(row: Record<string, unknown>) {
  const employeeName = `${String(row.first_name ?? '').trim()} ${String(row.last_name ?? '').trim()}`.trim()
  const basic = num(row.basic_pay)
  const overtime = num(row.overtime_pay)
  const eventDuty = num(row.holiday_pay)
  const allowance = num(row.service_charge)
  const gross = num(row.gross_pay)
  const whTax = num(row.tax_amount)
  const sss = num(row.sss_amount)
  const philhealth = num(row.philhealth_amount)
  const hdmf = num(row.pagibig_amount)
  const loan = num(row.loan_deduction)
  const ca = num(row.cash_advance)
  const hsng = num(row.housing_deduction)
  const tardiness = num(row.tardiness)
  const otherAdj = num(row.other_adjustments)
  const misc = Math.max(0, otherAdj - ca - tardiness - hsng)

  const payBasis = String(row.pay_basis ?? 'daily')
  const regularHours = num(row.regular_hours)
  let days: string
  if (payBasis === 'daily') {
    days =
      regularHours > 0
        ? (regularHours > 15 ? regularHours / 8 : regularHours).toLocaleString('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : '0.00'
  } else {
    days =
      regularHours > 0
        ? (regularHours / 8).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0.00'
  }

  const start = String(row.period_start ?? '')
  const end = String(row.period_end ?? '')
  const runType = String(row.run_type ?? '')
  const payFreq = String(row.pay_frequency ?? 'semi_monthly')
  const title =
    runType === '13th_month'
      ? 'PAYSLIP - 13TH MONTH PAY'
      : payFreq === 'monthly'
        ? 'PAYSLIP - MONTHLY PAYROLL'
        : 'PAYSLIP - SEMI-MONTHLY PAYROLL'

  const status = String(row.employment_status ?? '')
  const statusLabel = status ? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'N/A'

  return {
    title,
    periodLabel: formatPeriod(start, end),
    basicPay: basic,
    overtime,
    earningsSubtotal: Math.round((basic + overtime) * 100) / 100,
    employeeName: employeeName || '—',
    status: statusLabel,
    position: String(row.position_title ?? '').trim() || '—',
    eventDuty,
    allowance,
    grossPay: gross,
    days,
    basePayRate: num(row.pay_rate),
    adjustmentsAmount: misc,
    deductions: { whTax, sss, sssLoan: 0, philhealth, hdmf },
    tardiness,
    outstandingLoan: loan,
    ca,
    hsng,
    less: { ca, loan, hsng },
    netPay: num(row.net_pay),
    payDate: String(row.pay_date ?? ''),
  }
}

export function payslipHtml(row: Record<string, unknown>, includeLogo = true): string {
  const d = buildPayslipData(row)
  const watermark = includeLogo
    ? `<div class="watermark" aria-hidden="true"><table class="wm-table" cellpadding="0" cellspacing="0"><tr><td>${watermarkImgTag()}</td></tr></table></div>`
    : ''

  const midDedRows = kvRows([
    ['TARDINESS', money(d.tardiness), false],
    ['OUTSTANDING LOAN', money(d.outstandingLoan), false],
    ['CA', blank(d.ca), true],
    ['HSNG', blank(d.hsng), true],
  ])

  const summaryRows = kvRows([
    ['EVENT Duty:', money(d.eventDuty), false],
    ['ALLOWANCE :', money(d.allowance), false],
    ['GROSS PAY:', money(d.grossPay), false, 'strong'],
  ])

  const lessRows = kvRows([
    ['CA', blank(d.less.ca), true, 'sub'],
    ['LOAN Partial Payment', blank(d.less.loan), true, 'sub'],
    ['HSNG', blank(d.less.hsng), true, 'sub'],
  ])

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Payslip — ${esc(d.employeeName)}</title>${styles()}</head><body><article class="tpl">${watermark}<header class="brand"><p class="company-name">${esc(COMPANY)}</p><div class="title-block"><div class="banner-wrap"><span class="banner">${esc(d.title)}</span></div><p class="period">PERIOD : <strong>${esc(d.periodLabel)}</strong></p></div></header><table class="top-sum" cellpadding="0" cellspacing="0" align="right"><tr><td class="lbl">BASIC PAY:</td><td class="num">${money(d.basicPay)}</td><td class="gap"></td><td class="lbl">OT</td><td class="num">${money(d.overtime)}</td><td class="gap"></td><td class="num total">${money(d.earningsSubtotal)}</td></tr></table><table class="emp" width="100%" cellpadding="0" cellspacing="0"><tr><td width="40%"><strong>EMPLOYEE:</strong> ${esc(d.employeeName)}</td><td width="22%"><strong>STATUS:</strong> ${esc(d.status)}</td><td width="38%"><strong>POSITION:</strong> ${esc(d.position)}</td></tr></table><table class="main-grid" width="100%" cellpadding="0" cellspacing="0"><tr><td class="col" width="42%"><table class="tbl" width="100%" cellpadding="0" cellspacing="0"><thead><tr><th width="22%"></th><th width="14%">Days</th><th width="20%">BASE PAY</th><th width="22%">ADJUSTMENTS</th><th width="22%">AMOUNT</th></tr></thead><tbody><tr><td><strong>REGULAR</strong></td><td class="center">${esc(d.days)}</td><td class="num">${money(d.basePayRate)}</td><td class="center">OTHERS</td><td class="num dotted">${d.adjustmentsAmount > 0 ? money(d.adjustmentsAmount) : '&nbsp;'}</td></tr></tbody></table></td><td class="col" width="33%"><table class="tbl" width="100%" cellpadding="0" cellspacing="0"><thead><tr><th>DEDUCTION</th><th width="38%">AMOUNT</th></tr></thead><tbody><tr><td>W/H TAX</td><td class="num">${money(d.deductions.whTax)}</td></tr><tr><td>SSS</td><td class="num">${d.deductions.sss > 0 ? money(d.deductions.sss) : '&nbsp;'}</td></tr><tr><td>SSS loan</td><td class="num">${d.deductions.sssLoan > 0 ? money(d.deductions.sssLoan) : '&nbsp;'}</td></tr><tr><td>PHILHEALTH</td><td class="num">${d.deductions.philhealth > 0 ? money(d.deductions.philhealth) : '&nbsp;'}</td></tr><tr><td>HDMF</td><td class="num">${d.deductions.hdmf > 0 ? money(d.deductions.hdmf) : '&nbsp;'}</td></tr></tbody></table><table class="kv" width="100%" cellpadding="0" cellspacing="0">${midDedRows}</table></td><td class="col col-last" width="25%"><table class="kv" width="100%" cellpadding="0" cellspacing="0">${summaryRows}</table><p class="less-head">LESS:</p><table class="kv" width="100%" cellpadding="0" cellspacing="0">${lessRows}</table></td></tr></table><table class="net" width="100%" cellpadding="0" cellspacing="0"><tr><td><strong>NET PAY :</strong> <span class="net-amt">${money(d.netPay)}</span></td></tr></table><div class="received"><strong>RECEIVED BY:</strong><div class="sign-line"></div></div></article></body></html>`
}

export function payslipPeriodLabel(start: string, end: string): string {
  return formatPeriod(start, end)
}

export function payslipPdfFilename(name: string, periodLabel: string): string {
  const safeName = name.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'Employee'
  const safePeriod = periodLabel.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'period'
  return `Payslip_${safeName}_${safePeriod}.pdf`
}
