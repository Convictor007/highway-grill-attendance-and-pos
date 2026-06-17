import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { cancelSwap, respondSwap } from '@/lib/shift-swaps'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'shifts.view.self')
    if (!user.employee_id) return jsonError('No employee linked', 422)
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action ?? '')

    if (action === 'cancel') {
      if (!(await cancelSwap(id, user.employee_id))) {
        return jsonError('Swap request not found', 404)
      }
      return jsonOk({ cancelled: true })
    }

    if (action === 'accept' || action === 'reject') {
      const row = await respondSwap(id, action, user.employee_id)
      if (!row) return jsonError('Swap request not found', 404)
      return jsonOk(row)
    }

    return jsonError('action must be accept, reject, or cancel', 422)
  })
}
