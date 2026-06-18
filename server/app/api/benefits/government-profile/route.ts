import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { hasPermission } from '@/lib/permissions'
import { jsonError, jsonOk } from '@/lib/api-response'
import { getGovernmentProfile, upsertGovernmentProfile } from '@/lib/government-benefits'
import { writeAuditLog } from '@/lib/audit-log'
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

    return jsonOk(await getGovernmentProfile(employeeId))
  })
}

export async function PUT(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.manage')
    const body = (await request.json()) as Record<string, unknown>
    const employeeId = body.employee_id ? String(body.employee_id) : null
    if (!employeeId) return jsonError('employee_id required', 422)
    const before = await getGovernmentProfile(employeeId)
    const row = await upsertGovernmentProfile(employeeId, body)
    await writeAuditLog(user.id, 'update', 'employee_government_profiles', employeeId, before as Record<string, unknown>, row as Record<string, unknown>)
    return jsonOk(row)
  })
}
