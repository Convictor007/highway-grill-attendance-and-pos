import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { review } from '@/lib/leave'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'leave.approve')
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const status = String(body.status ?? '')
    const row = await review(id, status, user.id, body.notes ? String(body.notes) : null)
    if (!row) return jsonError('Request not found', 404)
    return jsonOk(row)
  })
}
