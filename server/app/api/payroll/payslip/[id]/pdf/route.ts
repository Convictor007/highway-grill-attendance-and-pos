import { requireUser } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { jsonError } from '@/lib/api-response'
import { getPayslip } from '@/lib/payroll'
import { generatePayslipPdf } from '@/lib/payslip-pdf'
import { payslipPdfFilename, payslipPeriodLabel } from '@/lib/payslip-renderer'
import { ForbiddenError } from '@/lib/errors'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export const maxDuration = 60

export async function GET(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    const { id } = await params

    const row = await getPayslip(id)
    if (!row) return jsonError('Payslip not found', 404)

    const canManage = hasPermission(user, 'payroll.view')
    const canSelf =
      hasPermission(user, 'payroll.view.self') && user.employee_id === String(row.employee_id)
    if (!canManage && !canSelf) throw new ForbiddenError()

    // Same PDF used for the email attachment, generated on demand (not stored).
    const pdf = await generatePayslipPdf(row)
    const name = `${String(row.first_name ?? '').trim()} ${String(row.last_name ?? '').trim()}`.trim()
    const periodLabel = payslipPeriodLabel(String(row.period_start ?? ''), String(row.period_end ?? ''))
    const filename = payslipPdfFilename(name, periodLabel)

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  })
}
