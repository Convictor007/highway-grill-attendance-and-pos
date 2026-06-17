import { requireUser } from '@/lib/auth'
import { jsonError, jsonOk } from '@/lib/api-response'
import { markRead } from '@/lib/notifications'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    const { id } = await params
    if (!(await markRead(id, user.id))) return jsonError('Notification not found', 404)
    return jsonOk({ read: true })
  })
}
