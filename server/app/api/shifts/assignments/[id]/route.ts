import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { deleteAssignment, updateAssignment } from '@/lib/shifts'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'shifts.manage')
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const row = await updateAssignment(id, body)
    if (!row) return jsonError('Assignment not found', 404)
    return jsonOk(row)
  })
}

export async function DELETE(_request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(_request)
    requirePermission(user, 'shifts.manage')
    const { id } = await params
    if (!(await deleteAssignment(id))) return jsonError('Assignment not found', 404)
    return jsonOk({})
  })
}
