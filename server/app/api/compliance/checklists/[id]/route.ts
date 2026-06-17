import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { deleteChecklist, updateChecklist } from '@/lib/compliance'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'compliance.view')
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const row = await updateChecklist(id, body)
    if (!row) return jsonError('Checklist not found', 404)
    return jsonOk(row)
  })
}

export async function DELETE(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'compliance.view')
    const { id } = await params
    if (!(await deleteChecklist(id))) return jsonError('Checklist not found', 404)
    return jsonOk({})
  })
}
