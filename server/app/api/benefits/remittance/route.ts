import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { remittanceSummary } from '@/lib/government-benefits'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.manage')
    const url = new URL(request.url)
    const year = Number(url.searchParams.get('year') ?? new Date().getFullYear())
    const month = Number(url.searchParams.get('month') ?? new Date().getMonth() + 1)
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return jsonError('year and month are required', 422)
    }
    const branchId = url.searchParams.get('branch_id')
    return jsonOk(await remittanceSummary(year, month, branchId))
  })
}
