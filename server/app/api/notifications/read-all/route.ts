import { requireUser } from '@/lib/auth'
import { jsonOk } from '@/lib/api-response'
import { markAllRead } from '@/lib/notifications'
import { handleRoute } from '@/lib/route-handler'

export async function PUT(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    await markAllRead(user.id)
    return jsonOk({ read: true })
  })
}
