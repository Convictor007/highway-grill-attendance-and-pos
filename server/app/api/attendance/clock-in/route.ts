import { requireUser } from '@/lib/auth'
import { requireActiveEmployeeAccount, requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { optionalAccuracy, optionalCoords } from '@/lib/attendance-route-helpers'
import { clockIn } from '@/lib/attendance'
import { handleRoute } from '@/lib/route-handler'

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'attendance.self')
    requireActiveEmployeeAccount(user)
    const body = (await request.json()) as Record<string, unknown>
    const employeeId = user.employee_id ?? (body.employee_id ? String(body.employee_id) : null)
    if (!employeeId) return jsonError('No employee linked to user', 422)
    const [lat, lng] = optionalCoords(body)
    const address = body.address != null ? String(body.address).trim() : null
    return jsonOk(await clockIn(employeeId, 'app', lat, lng, address || null, optionalAccuracy(body)))
  })
}
