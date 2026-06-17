import { requireUser } from '@/lib/auth'
import { requireActiveEmployeeAccount, requirePermission } from '@/lib/auth-guard'
import { hasPermission } from '@/lib/permissions'
import { jsonError, jsonOk } from '@/lib/api-response'
import { createRequest, requests } from '@/lib/leave'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'leave.view')
    const url = new URL(request.url)
    const employeeId = hasPermission(user, 'leave.approve')
      ? url.searchParams.get('employee_id')
      : (user.employee_id ?? null)
    return jsonOk(await requests(employeeId, url.searchParams.get('status')))
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'leave.apply')
    requireActiveEmployeeAccount(user)
    const body = (await request.json()) as Record<string, unknown>
    body.employee_id = body.employee_id ?? user.employee_id
    if (!body.employee_id || !body.leave_type_id || !body.start_date || !body.end_date) {
      return jsonError('Missing required fields', 422)
    }
    if (!body.days_count) {
      const start = new Date(String(body.start_date))
      const end = new Date(String(body.end_date))
      body.days_count = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
    }
    return jsonOk(await createRequest(body), 201)
  })
}
