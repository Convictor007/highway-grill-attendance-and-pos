import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { createDepartment, listDepartments } from '@/lib/settings'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'employees.view')
    const branchId = new URL(request.url).searchParams.get('branch_id')
    return jsonOk(await listDepartments(branchId))
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'settings.departments.manage')
    const body = (await request.json()) as Record<string, unknown>
    if (!body.branch_id || !body.name) return jsonError('branch_id and name required', 422)
    return jsonOk(await createDepartment(body), 201)
  })
}
