import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { createPool, listPools } from '@/lib/tips'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.view')
    return jsonOk(await listPools(new URL(request.url).searchParams.get('branch_id')))
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.manage')
    const body = (await request.json()) as Record<string, unknown>
    if (!body.branch_id || !body.pool_date || body.total_tips == null) {
      return jsonError('branch_id, pool_date, total_tips required', 422)
    }
    return jsonOk(await createPool(body), 201)
  })
}
