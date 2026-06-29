import { requireUser } from '@/lib/auth'
import { requireActiveEmployeeAccount, requirePermission } from '@/lib/auth-guard'
import { hasPermission } from '@/lib/permissions'
import { jsonError, jsonOk } from '@/lib/api-response'
import { createCorrectionRequest, listMyRequests, listRequests } from '@/lib/attendance-corrections'
import { handleRoute } from '@/lib/route-handler'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    const url = new URL(request.url)
    if (hasPermission(user, 'attendance.correct.approve')) {
      return jsonOk(await listRequests(url.searchParams.get('status')))
    }
    requirePermission(user, 'attendance.self')
    requireActiveEmployeeAccount(user)
    if (!user.employee_id) return jsonError('No employee linked', 422)
    return jsonOk(await listMyRequests(user.employee_id))
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'attendance.self')
    requireActiveEmployeeAccount(user)
    if (!user.employee_id) return jsonError('No employee linked', 422)
    checkRateLimit(`att-correction:${user.id}`, 10, 24 * 60 * 60 * 1000)
    const body = (await request.json()) as Record<string, unknown>
    return jsonOk(await createCorrectionRequest(user.employee_id, body), 201)
  })
}
