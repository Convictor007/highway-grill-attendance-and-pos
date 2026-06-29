import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { hasPermission } from '@/lib/permissions'
import { jsonError, jsonOk } from '@/lib/api-response'
import { getPayslip, getRun, isPayslipVisibleToEmployee, updateRun } from '@/lib/payroll'
import { ForbiddenError } from '@/lib/errors'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

const RESERVED = new Set([
  'runs',
  'payslips',
  'run-roster',
  'prepare',
  'suggested-period',
  'my-payslips',
  'adjustments',
  'payslip',
])

export async function GET(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    const { id } = await params
    if (RESERVED.has(id)) return jsonError('Not found', 404)
    const run = await getRun(id)
    if (run) {
      requirePermission(user, 'payroll.view')
      return jsonOk(run)
    }
    const payslip = await getPayslip(id)
    if (!payslip) return jsonError('Not found', 404)
    if (hasPermission(user, 'payroll.view')) return jsonOk(payslip)
    if (hasPermission(user, 'payroll.view.self') && user.employee_id === String(payslip.employee_id)) {
      // Employees may only view their payslip once HR has emailed (or paid) it.
      if (!isPayslipVisibleToEmployee(payslip.payment_status)) {
        throw new ForbiddenError('This payslip is not available yet')
      }
      return jsonOk(payslip)
    }
    throw new ForbiddenError()
  })
}

export async function PUT(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.manage')
    const { id } = await params
    if (RESERVED.has(id)) return jsonError('Not found', 404)
    const body = (await request.json()) as Record<string, unknown>
    const row = await updateRun(id, body, user.id)
    if (!row) return jsonError('Payroll run not found', 404)
    return jsonOk(row)
  })
}
