import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { hasPermission } from '@/lib/permissions'
import { jsonError, jsonOk } from '@/lib/api-response'
import { create, forBranch, listAll } from '@/lib/announcements'
import { getDb } from '@/lib/db'
import { ForbiddenError } from '@/lib/errors'
import { handleRoute } from '@/lib/route-handler'
import { pushToAllUsers } from '@/lib/push'
import { createNotification } from '@/lib/notifications'

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

    const priority = String(body.priority ?? 'normal')
    const prefix = priority === 'urgent' ? 'URGENT: ' : ''
    const title = `${prefix}${String(body.title).trim()}`
    const bodyText = String(body.body ?? '').trim().slice(0, 200)

    // Create in-app notifications for all active users (branch-scoped if branch_id is set)
    const db = getDb()
    const branchId = body.branch_id != null && body.branch_id !== '' ? String(body.branch_id) : null
    let users: { id: string }[]
    if (branchId) {
      users = await db<{ id: string }[]>`
        SELECT DISTINCT u.id::text FROM users u
        INNER JOIN employees e ON e.id = u.employee_id
        WHERE u.is_active = true AND u.account_status = 'active'
          AND e.branch_id = ${branchId}
      `
    } else {
      users = await db<{ id: string }[]>`
        SELECT id::text FROM users WHERE is_active = true AND account_status = 'active'
      `
    }
    for (const u of users) {
      createNotification(u.id, 'memo', title, bodyText, String(announcement?.id ?? ''), '/memos').catch(() => {})
    }

    // Send push notification to all employees
    pushToAllUsers(title, bodyText, { type: 'memo' }).catch(() => {})

    return jsonOk(announcement, 201)
  })
}
