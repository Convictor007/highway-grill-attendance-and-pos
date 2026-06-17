import { requireUser } from '@/lib/auth'
import { requireActiveEmployeeAccount, requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { apply } from '@/lib/loans'
import { handleRoute } from '@/lib/route-handler'

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'loans.self')
    requireActiveEmployeeAccount(user)
    const body = (await request.json()) as Record<string, unknown>
    body.employee_id = body.employee_id ?? user.employee_id
    if (!body.employee_id || body.principal == null) return jsonError('principal required', 422)
    return jsonOk(await apply(body), 201)
  })
}
