import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { createContract } from '@/lib/contracts'
import { handleRoute } from '@/lib/route-handler'

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'employees.manage')
    const body = (await request.json()) as Record<string, unknown>
    if (!body.employee_id || !body.start_date) return jsonError('employee_id and start_date required', 422)
    return jsonOk(await createContract(body), 201)
  })
}
