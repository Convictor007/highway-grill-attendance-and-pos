import { requireUser } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { getDb } from '@/lib/db'
import { jsonError, jsonOk } from '@/lib/api-response'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    if (!hasPermission(user, 'employees.view')) return jsonError('Forbidden', 403)
    const branchId = new URL(request.url).searchParams.get('branch_id')
    const db = getDb()
    const rows = branchId
      ? await db`
          SELECT id, branch_id, name, cost_center FROM departments
          WHERE branch_id = ${branchId} ORDER BY name
        `
      : await db`SELECT id, branch_id, name, cost_center FROM departments ORDER BY name`
    return jsonOk(rows)
  })
}
