import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { remittanceSummary } from '@/lib/government-benefits'
import { handleRoute } from '@/lib/route-handler'

function manilaNow() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000)
}

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.manage')
    const url = new URL(request.url)
    const now = manilaNow()
    const year = Number(url.searchParams.get('year') ?? now.getUTCFullYear())
    const month = Number(url.searchParams.get('month') ?? now.getUTCMonth() + 1)
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return jsonError('year and month are required', 422)
    }
    const branchId = url.searchParams.get('branch_id')
    return jsonOk(await remittanceSummary(year, month, branchId))
  })
}
