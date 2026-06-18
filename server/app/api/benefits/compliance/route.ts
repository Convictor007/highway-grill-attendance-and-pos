import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { benefitsComplianceReport } from '@/lib/government-benefits'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.manage')
    const branchId = new URL(request.url).searchParams.get('branch_id')
    return jsonOk(await benefitsComplianceReport(branchId))
  })
}
