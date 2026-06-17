import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { createBranch, listBranches } from '@/lib/settings'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'employees.view')
    return jsonOk(await listBranches())
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'settings.branches.manage')
    const body = (await request.json()) as Record<string, unknown>
    if (!body.name) return jsonError('name required', 422)
    return jsonOk(await createBranch(body), 201)
  })
}
