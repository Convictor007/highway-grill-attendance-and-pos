import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { undeferEmployees } from '@/lib/payroll'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.manage')
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const ids = body.employee_ids
    if (!Array.isArray(ids) || ids.length === 0) return jsonError('employee_ids required', 422)
    return jsonOk(await undeferEmployees(id, ids.map(String)))
  })
}
