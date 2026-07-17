import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { hasPermission } from '@/lib/permissions'
import { jsonError, jsonOk } from '@/lib/api-response'
import { create, forBranch, listAll } from '@/lib/announcements'
import { getDb } from '@/lib/db'
import { ForbiddenError } from '@/lib/errors'
import { handleRoute } from '@/lib/route-handler'
import { pushToAllUsers } from '@/lib/push'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    if (!hasPermission(user, 'announcements.view') && !hasPermission(user, 'employees.manage')) {
      throw new ForbiddenError()
    }
    if (hasPermission(user, 'employees.manage')) {
      return jsonOk(await listAll())
    }
    const url = new URL(request.url)
    let branchId = url.searchParams.get('branch_id')
    if (!branchId && user.employee_id) {
      const db = getDb()
      const rows = await db`SELECT branch_id FROM employees WHERE id = ${user.employee_id} LIMIT 1`
      branchId = rows[0]?.branch_id ? String(rows[0].branch_id) : null
    }
    return jsonOk(await forBranch(branchId))
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'employees.manage')
    const body = (await request.json()) as Record<string, unknown>
    if (!body.title || !body.body) return jsonError('title and body required', 422)
    const announcement = await create(body, user.id)

    // Send push notification to all employees
    const priority = String(body.priority ?? 'normal')
    const prefix = priority === 'urgent' ? 'URGENT: ' : ''
    pushToAllUsers(
      `${prefix}${String(body.title).trim()}`,
      String(body.body ?? '').trim().slice(0, 200),
      { type: 'memo' },
    ).catch(() => {})

    return jsonOk(announcement, 201)
  })
}
