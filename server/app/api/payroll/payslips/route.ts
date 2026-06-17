import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { payslips } from '@/lib/payroll'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.view')
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') ?? 25)))
    return jsonOk(
      await payslips(url.searchParams.get('run_id'), (url.searchParams.get('q') ?? '').trim(), page, limit),
    )
  })
}
