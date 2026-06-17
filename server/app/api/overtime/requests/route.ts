import { requireUser } from '@/lib/auth'
import { requireActiveEmployeeAccount, requirePermission } from '@/lib/auth-guard'
import { hasPermission } from '@/lib/permissions'
import { jsonError, jsonOk } from '@/lib/api-response'
import { create, list } from '@/lib/overtime'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    if (hasPermission(user, 'attendance.manage')) {
      const employeeId = new URL(request.url).searchParams.get('employee_id')
      return jsonOk(await list(employeeId))
    }
    requirePermission(user, 'overtime.apply')
    requireActiveEmployeeAccount(user)
    return jsonOk(await list(user.employee_id ?? null))
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    if (!hasPermission(user, 'attendance.manage')) {
      return jsonError(
        'Overtime is recorded automatically from your DTR when you work past your shift, 9 hours, or midnight.',
        422,
      )
    }
    const body = (await request.json()) as Record<string, unknown>
    body.employee_id = body.employee_id ?? user.employee_id
    if (!body.employee_id || !body.request_date || !body.extra_hours) {
      return jsonError('request_date and extra_hours required', 422)
    }
    return jsonOk(await create(body), 201)
  })
}
