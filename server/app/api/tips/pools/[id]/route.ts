import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { distribute, distributeEqualAmongTipped, distributions, getPool } from '@/lib/tips'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.view')
    const { id } = await params
    const pool = await getPool(id)
    if (!pool) return jsonError('Pool not found', 404)
    return jsonOk({ ...pool, distributions: await distributions(id) })
  })
}

export async function POST(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.manage')
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    if (body.equal) return jsonOk(await distributeEqualAmongTipped(id))
    const allocations = body.allocations
    if (!Array.isArray(allocations)) return jsonError('allocations array required', 422)
    return jsonOk(await distribute(id, allocations as Record<string, unknown>[]))
  })
}
