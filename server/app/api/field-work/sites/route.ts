import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { hasPermission } from '@/lib/permissions'
import { jsonError, jsonOk } from '@/lib/api-response'
import * as fieldWork from '@/lib/field-work'
import { getDb } from '@/lib/db'
import { ForbiddenError } from '@/lib/errors'
import { handleRoute } from '@/lib/route-handler'

async function resolveBranchId(user: { employee_id?: string | null }, queryBranch?: string | null) {
  if (queryBranch) return queryBranch
  if (!user.employee_id) return null
  const db = getDb()
  const rows = await db`SELECT branch_id FROM employees WHERE id = ${user.employee_id} LIMIT 1`
  return rows[0]?.branch_id ? String(rows[0].branch_id) : null
}

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    if (!hasPermission(user, 'attendance.self') && !hasPermission(user, 'attendance.view')) {
      throw new ForbiddenError()
    }
    const branchId = await resolveBranchId(user, new URL(request.url).searchParams.get('branch_id'))
    const sites = hasPermission(user, 'attendance.view')
      ? await fieldWork.listSites(branchId)
      : await fieldWork.listClockInSites(branchId)
    return jsonOk(sites)
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'attendance.manage')
    const body = (await request.json()) as Record<string, unknown>
    return jsonOk(await fieldWork.createSite(body), 201)
  })
}
