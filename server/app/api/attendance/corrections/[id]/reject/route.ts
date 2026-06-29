import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { rejectRequest } from '@/lib/attendance-corrections'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'attendance.correct.approve')
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const row = await rejectRequest(id, user.id, body.note ? String(body.note) : null)
    if (!row) return jsonError('Request not found', 404)
    return jsonOk(row)
  })
}
