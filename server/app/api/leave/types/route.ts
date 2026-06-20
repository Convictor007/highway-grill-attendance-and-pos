import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { hasPermission } from '@/lib/permissions'
import { jsonOk } from '@/lib/api-response'
import { types } from '@/lib/leave'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'leave.view')
    const url = new URL(request.url)
    const all = url.searchParams.get('all') === '1' && hasPermission(user, 'leave.manage')
    const employeeId = all ? null : (user.employee_id ?? null)
    return jsonOk(await types(all, employeeId))
  })
}
