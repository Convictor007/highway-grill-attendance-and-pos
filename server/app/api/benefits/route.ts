import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { hasPermission } from '@/lib/permissions'
import { jsonError, jsonOk } from '@/lib/api-response'
import { create, list } from '@/lib/benefits'
import { writeAuditLog } from '@/lib/audit-log'
import { ForbiddenError } from '@/lib/errors'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    const url = new URL(request.url)
    let employeeId = url.searchParams.get('employee_id')
    if (!employeeId && hasPermission(user, 'payroll.view')) {
      return jsonOk(await list())
    }
    if (!employeeId) employeeId = user.employee_id ?? null
    if (!employeeId) return jsonError('employee_id required', 422)
    if (!hasPermission(user, 'payroll.view') && user.employee_id !== employeeId) {
      throw new ForbiddenError()
    }
    return jsonOk(await list(employeeId))
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.manage')
    const body = (await request.json()) as Record<string, unknown>
    if (!body.employee_id || !body.benefit_name) {
      return jsonError('employee_id and benefit_name required', 422)
    }
    const row = await create(body)
    await writeAuditLog(user.id, 'create', 'employee_benefit_enrollments', row.id, null, row as Record<string, unknown>)
    return jsonOk(row, 201)
  })
}
