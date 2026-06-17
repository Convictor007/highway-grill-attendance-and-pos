import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { manualEntry } from '@/lib/attendance'
import { handleRoute } from '@/lib/route-handler'

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'attendance.manage')
    const body = (await request.json()) as Record<string, unknown>
    if (!body.employee_id) return jsonError('employee_id required', 422)
    return jsonOk(await manualEntry(body, user.id), 201)
  })
}
