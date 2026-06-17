import { requireUser } from '@/lib/auth'
import { requireActiveEmployeeAccount, requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { myShifts } from '@/lib/shifts'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'shifts.view.self')
    requireActiveEmployeeAccount(user)
    if (!user.employee_id) return jsonError('No employee linked', 422)
    const url = new URL(request.url)
    return jsonOk(await myShifts(user.employee_id, url.searchParams.get('from'), url.searchParams.get('to')))
  })
}
