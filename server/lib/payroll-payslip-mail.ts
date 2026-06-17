import { getDb } from './db'
import { config } from './env'
import { mailLastError, sendMail } from './mail'
import { createNotification, userIdForEmployee } from './notifications'
import { generatePayslipPdf } from './payslip-pdf'
import { payslipPdfFilename, payslipPeriodLabel } from './payslip-renderer'
import { savePublicFile } from './storage'

type MailResult = Record<string, unknown>

async function loadPayroll() {
  return import('./payroll')
}

async function resolveEmployeeEmail(employeeId: string): Promise<string | null> {
  const db = getDb()
  const rows = await db`
    SELECT COALESCE(NULLIF(TRIM(e.email), ''), NULLIF(TRIM(u.email), '')) AS email
    FROM employees e
    LEFT JOIN users u ON u.employee_id = e.id AND u.is_active = true
    WHERE e.id = ${employeeId}
    ORDER BY u.id DESC
    LIMIT 1
  `
  const email = String(rows[0]?.email ?? '').trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

async function archivePayslipPdf(
  row: Record<string, unknown>,
  pdf: Buffer,
  actorUserId?: string | null,
): Promise<number | null> {
  const employeeId = String(row.employee_id)
  const periodLabel = payslipPeriodLabel(String(row.period_start ?? ''), String(row.period_end ?? ''))
  const title = `Payslip ${periodLabel}`
  const filename = `payslip-${String(row.id)}.pdf`
  const url = await savePublicFile('documents', filename, pdf, 'application/pdf')
  const sizeKb = Math.max(1, Math.ceil(pdf.length / 1024))

  const db = getDb()
  const [doc] = await db`
    INSERT INTO documents (employee_id, category, title, file_url, file_type, file_size_kb, is_confidential, uploaded_by)
    VALUES (${employeeId}, 'payslip', ${title}, ${url}, 'application/pdf', ${sizeKb}, false, ${actorUserId ?? null})
    RETURNING id
  `
  return doc?.id ? Number(doc.id) : null
}

function buildEmailBodies(
  name: string,
  periodLabel: string,
  payDate: string,
  netPay: number,
) {
  const appUrl = config.appUrl.replace(/\/$/, '')
  const netFormatted = netPay.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const subject = `Highway Grill Payslip — ${periodLabel}${name ? ` — ${name}` : ''}`

  const textLines = [
    `Hello${name ? ` ${name}` : ''},`,
    '',
    `Your payslip for period ${periodLabel} is attached.`,
    payDate ? `Pay date: ${payDate}` : null,
    `Net pay: ₱${netFormatted}`,
    appUrl ? `View in portal: ${appUrl}/payroll` : null,
    '',
    '— Highway Grill HR',
  ].filter(Boolean)

  const textBody = textLines.join('\n')
  const htmlBody =
    `<p>Hello${name ? ` <strong>${escapeHtml(name)}</strong>` : ''},</p>` +
    `<p>Your payslip for period <strong>${escapeHtml(periodLabel)}</strong> is attached.</p>` +
    (payDate ? `<p>Pay date: ${escapeHtml(payDate)}</p>` : '') +
    `<p>Net pay: <strong>₱${escapeHtml(netFormatted)}</strong></p>` +
    (appUrl ? `<p><a href="${escapeHtml(`${appUrl}/payroll`)}">Open My Payroll</a></p>` : '') +
    '<p>— Highway Grill HR</p>'

  return { subject, textBody, htmlBody }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function notifyEmployee(
  employeeId: string,
  periodLabel: string,
  payslipId: string,
): Promise<void> {
  const userId = await userIdForEmployee(employeeId)
  if (!userId) return
  const appUrl = config.appUrl.replace(/\/$/, '')
  await createNotification(
    userId,
    'payslip',
    `Payslip ready — ${periodLabel}`,
    'Your payslip was emailed and is available in My Payroll.',
    payslipId,
    appUrl ? `${appUrl}/payroll` : '/payroll',
  )
}

export async function sendRunPayslips(runId: string, actorUserId?: string | null) {
  const { getRun } = await loadPayroll()
  const run = await getRun(runId)
  if (!run) throw new Error('Payroll run not found')

  const status = String(run.status ?? '')
  if (!['approved', 'paid'].includes(status)) {
    throw new Error('Approve the payroll run before sending payslips')
  }

  const db = getDb()
  const rows = await db`
    SELECT id FROM payslips WHERE payroll_run_id = ${runId} ORDER BY employee_id
  `

  const result = { sent: 0, skipped: 0, failed: 0, details: [] as MailResult[] }
  for (const row of rows) {
    const detail = await sendPayslip(String(row.id), actorUserId)
    result.details.push(detail)
    const st = String(detail.status ?? 'failed')
    if (st === 'sent') result.sent++
    else if (st === 'skipped') result.skipped++
    else result.failed++
  }
  return result
}

export async function sendPayslip(payslipId: string, actorUserId?: string | null): Promise<MailResult> {
  const { getPayslip } = await loadPayroll()
  const row = await getPayslip(payslipId)
  if (!row) throw new Error('Payslip not found')

  const runStatus = String(row.run_status ?? '')
  if (!['approved', 'paid'].includes(runStatus)) {
    throw new Error('Payroll run must be approved or paid before sending payslips')
  }

  const employeeId = String(row.employee_id)
  const name = `${String(row.first_name ?? '').trim()} ${String(row.last_name ?? '').trim()}`.trim()
  const periodLabel = payslipPeriodLabel(String(row.period_start ?? ''), String(row.period_end ?? ''))
  const email = await resolveEmployeeEmail(employeeId)

  if (!email) {
    return {
      payslip_id: payslipId,
      employee_id: employeeId,
      employee_name: name,
      status: 'skipped',
      reason: 'No email on file',
      skipped: true,
    }
  }

  try {
    const pdf = await generatePayslipPdf(row)
    await archivePayslipPdf(row, pdf, actorUserId)

    const filename = payslipPdfFilename(name, periodLabel)
    const netPay = Number(row.net_pay ?? 0)
    const payDate = String(row.pay_date ?? '')
    const { subject, textBody, htmlBody } = buildEmailBodies(name, periodLabel, payDate, netPay)

    const sent = await sendMail({
      to: email,
      subject,
      text: textBody,
      html: htmlBody,
      attachments: [{ filename, content: pdf, contentType: 'application/pdf' }],
    })

    if (!sent) {
      return {
        payslip_id: payslipId,
        employee_id: employeeId,
        employee_name: name,
        email,
        status: 'failed',
        reason: mailLastError() ?? 'Mail not sent (check MAIL_ENABLED and SMTP settings)',
      }
    }

    await notifyEmployee(employeeId, periodLabel, payslipId)

    return {
      payslip_id: payslipId,
      employee_id: employeeId,
      employee_name: name,
      email,
      status: 'sent',
      sent: true,
    }
  } catch (err) {
    return {
      payslip_id: payslipId,
      employee_id: employeeId,
      employee_name: name,
      email,
      status: 'failed',
      reason: err instanceof Error ? err.message : 'Payslip email failed',
    }
  }
}
