import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { hasPermission } from '@/lib/permissions'
import { jsonError, jsonOk } from '@/lib/api-response'
import { getDeductionSetup } from '@/lib/government-benefits'
import { ForbiddenError } from '@/lib/errors'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    const url = new URL(request.url)
    let employeeId = url.searchParams.get('employee_id')
    if (!employeeId) employeeId = user.employee_id ?? null
    if (!employeeId) return jsonError('employee_id required', 422)

    const canViewAll = hasPermission(user, 'payroll.view')
    const isSelf = user.employee_id === employeeId
    if (!canViewAll && !isSelf) throw new ForbiddenError()
    if (!canViewAll && !hasPermission(user, 'payroll.view.self')) throw new ForbiddenError()

    return jsonOk(await getDeductionSetup(employeeId))
  })
}
