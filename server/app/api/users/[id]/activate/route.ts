import { requireUser } from '@/lib/auth'
import { requireCrewApproval } from '@/lib/auth-guard'
import { logAuthEvent } from '@/lib/auth-events'
import { clientIp, userAgent } from '@/lib/client-ip'
import { jsonOk } from '@/lib/api-response'
import { activateEmployee } from '@/lib/users'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requireCrewApproval(user)
    const { id } = await params
    const updated = await activateEmployee(id, user.id)
    await logAuthEvent({
      eventType: 'register_activated',
      userId: updated.id,
      email: updated.email,
      ipAddress: clientIp(request),
      userAgent: userAgent(request),
      meta: { activated_by: user.id },
    })
    return jsonOk(updated)
  })
}
