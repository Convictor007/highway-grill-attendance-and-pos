import { requireUser } from '@/lib/auth'
import { requireCrewApproval } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { listPendingRegistrations } from '@/lib/users'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requireCrewApproval(user)
    return jsonOk(await listPendingRegistrations())
  })
}
