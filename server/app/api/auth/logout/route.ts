import { bearerToken, logout, userFromToken } from '@/lib/auth'
import { logAuthEvent } from '@/lib/auth-events'
import { clientIp, userAgent } from '@/lib/client-ip'
import { jsonOk } from '@/lib/api-response'
import { handleRoute } from '@/lib/route-handler'

export async function POST(request: Request) {
  return handleRoute(async () => {
    const token = bearerToken(request)
    const user = await userFromToken(token)
    await logout(token)
    if (user) {
      await logAuthEvent({
        eventType: 'logout',
        userId: user.id,
        email: user.email,
        ipAddress: clientIp(request),
        userAgent: userAgent(request),
      })
    }
    return jsonOk({ ok: true })
  })
}
