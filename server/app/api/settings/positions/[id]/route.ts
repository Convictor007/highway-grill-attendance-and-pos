import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { deletePosition, updatePosition } from '@/lib/settings'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'settings.departments.manage')
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const row = await updatePosition(id, body)
    if (!row) return jsonError('Position not found', 404)
    return jsonOk(row)
  })
}

export async function DELETE(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'settings.departments.manage')
    const { id } = await params
    const row = await deletePosition(id)
    if (!row) return jsonError('Position not found', 404)
    return jsonOk(null)
  })
}
