import { requireUser } from '@/lib/auth'
import { requireActiveEmployeeAccount, requirePermission } from '@/lib/auth-guard'
import { hasPermission } from '@/lib/permissions'
import { jsonOk } from '@/lib/api-response'
import { balances } from '@/lib/leave'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'leave.view')
    const url = new URL(request.url)
    let employeeId = url.searchParams.get('employee_id')
    if (!employeeId && !hasPermission(user, 'leave.approve')) {
      requireActiveEmployeeAccount(user)
      employeeId = user.employee_id ?? null
    }
    const yearRaw = url.searchParams.get('year')
    const year = yearRaw ? Number(yearRaw) : null
    return jsonOk(await balances(employeeId, year))
  })
}
