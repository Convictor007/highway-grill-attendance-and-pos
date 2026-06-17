import { requireUser } from '@/lib/auth'
import { requireActiveEmployeeAccount, requirePermission } from '@/lib/auth-guard'
import { hasPermission } from '@/lib/permissions'
import { jsonError, jsonOk } from '@/lib/api-response'
import { createSwap, listSwaps } from '@/lib/shift-swaps'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    if (hasPermission(user, 'shifts.manage')) {
      return jsonOk(await listSwaps(null, true))
    }
    requirePermission(user, 'shifts.view.self')
    requireActiveEmployeeAccount(user)
    if (!user.employee_id) return jsonError('No employee linked', 422)
    return jsonOk(await listSwaps(user.employee_id, false))
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'shifts.view.self')
    requireActiveEmployeeAccount(user)
    if (!user.employee_id) return jsonError('No employee linked', 422)
    const body = (await request.json()) as Record<string, unknown>
    return jsonOk(await createSwap(body, user.id, user.employee_id), 201)
  })
}
