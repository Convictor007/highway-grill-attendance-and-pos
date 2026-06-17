import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { cancelRequest } from '@/lib/leave'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'leave.apply')
    if (!user.employee_id) return jsonError('No employee linked', 422)
    const { id } = await params
    const row = await cancelRequest(id, user.employee_id)
    if (!row) return jsonError('Request not found', 404)
    return jsonOk(row)
  })
}
