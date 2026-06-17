import { requireUser } from '@/lib/auth'
import { requireActiveEmployeeAccount, requirePermission } from '@/lib/auth-guard'
import { hasPermission } from '@/lib/permissions'
import { jsonOk } from '@/lib/api-response'
import { list } from '@/lib/loans'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    const url = new URL(request.url)
    if (hasPermission(user, 'loans.manage')) {
      return jsonOk(await list(url.searchParams.get('employee_id'), url.searchParams.get('branch_id')))
    }
    requirePermission(user, 'loans.self')
    requireActiveEmployeeAccount(user)
    if (!user.employee_id) return jsonOk([])
    return jsonOk(await list(user.employee_id))
  })
}
