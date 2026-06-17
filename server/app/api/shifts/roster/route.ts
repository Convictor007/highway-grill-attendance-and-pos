import { requireUser } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { jsonError, jsonOk } from '@/lib/api-response'
import { rosterGrid } from '@/lib/shifts'
import { getDb } from '@/lib/db'
import { ForbiddenError } from '@/lib/errors'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    const url = new URL(request.url)
    let branchId = url.searchParams.get('branch_id')
    if (hasPermission(user, 'shifts.manage')) {
      if (!branchId) return jsonError('branch_id required', 422)
    } else if (hasPermission(user, 'shifts.view.self')) {
      if (!user.employee_id) return jsonError('No employee linked', 422)
      const db = getDb()
      const rows = await db`SELECT branch_id FROM employees WHERE id = ${user.employee_id} LIMIT 1`
      branchId = rows[0]?.branch_id ? String(rows[0].branch_id) : null
      if (!branchId) return jsonError('Employee branch not set', 422)
    } else {
      throw new ForbiddenError()
    }
    return jsonOk(await rosterGrid(branchId!, url.searchParams.get('week_start'), user.id))
  })
}
