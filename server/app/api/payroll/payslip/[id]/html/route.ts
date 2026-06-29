import { requireUser } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { jsonError, jsonOk } from '@/lib/api-response'
import { getPayslip } from '@/lib/payroll'
import { payslipHtml } from '@/lib/payslip-renderer'
import { ForbiddenError } from '@/lib/errors'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

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

    // Same template that powers the emailed PDF, so the on-screen view matches exactly.
    return jsonOk({ html: payslipHtml(row, true) })
  })
}
