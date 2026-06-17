import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { createRun, listRuns } from '@/lib/payroll'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.view')
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') ?? 25)))
    return jsonOk(
      await listRuns(
        url.searchParams.get('branch_id'),
        url.searchParams.get('status'),
        (url.searchParams.get('q') ?? '').trim(),
        page,
        limit,
      ),
    )
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.manage')
    const body = (await request.json()) as Record<string, unknown>
    if (!body.branch_id || !body.period_start || !body.period_end || !body.pay_date) {
      return jsonError('branch_id, period_start, period_end, pay_date required', 422)
    }
    return jsonOk(await createRun(body, user.id), 201)
  })
}
