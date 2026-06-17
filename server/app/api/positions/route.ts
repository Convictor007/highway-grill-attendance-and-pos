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
          SELECT p.id, p.department_id, p.title, p.pay_grade, p.min_hourly, p.max_hourly, p.is_tipped
          FROM positions p
          INNER JOIN departments d ON d.id = p.department_id
          WHERE d.branch_id = ${branchId}
          ORDER BY p.title
        `
      : await db`
          SELECT p.id, p.department_id, p.title, p.pay_grade, p.min_hourly, p.max_hourly, p.is_tipped
          FROM positions p ORDER BY p.title
        `
    return jsonOk(rows)
  })
}
