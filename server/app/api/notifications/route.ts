import { requireUser } from '@/lib/auth'
import { jsonOk } from '@/lib/api-response'
import { listForUser, unreadCount } from '@/lib/notifications'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    const url = new URL(request.url)
    const unread = url.searchParams.get('unread')
    const unreadOnly = unread === '1' || unread === 'true'
    return jsonOk({
      items: await listForUser(user.id, unreadOnly ? true : null),
      unread_count: await unreadCount(user.id),
    })
  })
}
