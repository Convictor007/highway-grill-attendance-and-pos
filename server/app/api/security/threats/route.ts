import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { listThreats } from '@/lib/security'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'security.view')
    const windowRaw = new URL(request.url).searchParams.get('window_minutes')
    const windowMinutes = windowRaw ? Number(windowRaw) : 60
    return jsonOk(await listThreats(windowMinutes))
  })
}
