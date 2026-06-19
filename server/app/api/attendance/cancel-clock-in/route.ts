import { requireUser } from '@/lib/auth'
import { requireActiveEmployeeAccount, requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { cancelMistakenClockIn } from '@/lib/attendance'
import { handleRoute } from '@/lib/route-handler'

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'attendance.self')
    requireActiveEmployeeAccount(user)
    if (!user.employee_id) throw new Error('No employee linked to user')
    return jsonOk(await cancelMistakenClockIn(user.employee_id))
  })
}
