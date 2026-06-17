import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { getBranch, updateBranch } from '@/lib/settings'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'employees.view')
    const { id } = await params
    const row = await getBranch(id)
    if (!row) return jsonError('Branch not found', 404)
    return jsonOk(row)
  })
}

export async function PUT(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'settings.branches.manage')
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const row = await updateBranch(id, body)
    if (!row) return jsonError('Branch not found', 404)
    return jsonOk(row)
  })
}
