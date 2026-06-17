import { requireUser } from '@/lib/auth'
import { requireActiveEmployeeAccount, requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { breakEnd } from '@/lib/attendance'
import { handleRoute } from '@/lib/route-handler'

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'attendance.self')
    requireActiveEmployeeAccount(user)
    if (!user.employee_id) return jsonError('No employee linked', 422)
    return jsonOk(await breakEnd(user.employee_id))
  })
}
