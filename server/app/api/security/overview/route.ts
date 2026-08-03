import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { securityOverview } from '@/lib/security'
import { countRecentlyTrackedDevices } from '@/lib/location-tracking'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'security.view')
    const overview = await securityOverview()
    let tracked_devices = 0
    try {
      tracked_devices = await countRecentlyTrackedDevices(30)
    } catch {
      tracked_devices = 0
    }
    return jsonOk({ ...overview, tracked_devices })
  })
}
