import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { updateSchedule } from '@/lib/shifts'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'shifts.manage')
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const row = await updateSchedule(id, body, user.id)
    if (!row) return jsonError('Schedule not found', 404)
    return jsonOk(row)
  })
}
