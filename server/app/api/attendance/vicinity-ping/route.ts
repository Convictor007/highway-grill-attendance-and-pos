import { requireUser } from '@/lib/auth'
import { requireActiveEmployeeAccount, requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { optionalAccuracy, optionalCoords } from '@/lib/attendance-route-helpers'
import * as auto from '@/lib/attendance-auto'
import { handleRoute } from '@/lib/route-handler'

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'attendance.self')
    requireActiveEmployeeAccount(user)
    if (!user.employee_id) return jsonError('No employee linked', 422)
    const body = (await request.json()) as Record<string, unknown>
    const [lat, lng] = optionalCoords(body)
    if (lat == null || lng == null) return jsonError('latitude and longitude required', 422)
    return jsonOk(await auto.vicinityPing(user.employee_id, lat, lng, optionalAccuracy(body)))
  })
}
