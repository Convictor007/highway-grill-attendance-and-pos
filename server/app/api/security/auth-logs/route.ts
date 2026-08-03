import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { listAuthEvents } from '@/lib/security'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'security.view')
    const url = new URL(request.url)
    const limit = url.searchParams.get('limit')
    const eventType = url.searchParams.get('event_type')
    const ip = url.searchParams.get('ip')
    return jsonOk(
      await listAuthEvents({
        limit: limit ? Number(limit) : 100,
        eventType,
        ip,
      }),
    )
  })
}
