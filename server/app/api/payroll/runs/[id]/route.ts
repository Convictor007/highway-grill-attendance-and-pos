import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { getRun } from '@/lib/payroll'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.view')
    const { id } = await params
    const row = await getRun(id)
    if (!row) return jsonError('Payroll run not found', 404)
    return jsonOk(row)
  })
}
