import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { coworkers } from '@/lib/shifts'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'shifts.view.self')
    if (!user.employee_id) return jsonError('No employee linked', 422)
    return jsonOk(await coworkers(user.employee_id))
  })
}
