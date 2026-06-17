import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { updateType } from '@/lib/leave'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'leave.manage')
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const row = await updateType(id, body)
    if (!row) return jsonError('Leave type not found', 404)
    return jsonOk(row)
  })
}
