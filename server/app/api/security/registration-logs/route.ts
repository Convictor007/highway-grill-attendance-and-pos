import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { listRegistrationEvents } from '@/lib/security'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'security.view')
    const limitRaw = new URL(request.url).searchParams.get('limit')
    const limit = limitRaw ? Number(limitRaw) : 100
    return jsonOk(await listRegistrationEvents(limit))
  })
}
