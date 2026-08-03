import { jsonError, jsonOk } from '@/lib/api-response'
import { logAuthEvent } from '@/lib/auth-events'
import { clientIp, userAgent } from '@/lib/client-ip'
import { enrichUser, login } from '@/lib/auth'
import { assertLoginRateLimit } from '@/lib/rate-limit'
import { handleRoute } from '@/lib/route-handler'

export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = (await request.json()) as { email?: string; password?: string }
    const email = String(body.email ?? '').trim()
    const password = String(body.password ?? '')
    if (!email || !password) return jsonError('Email and password required', 422)

    const ip = clientIp(request)
    const ua = userAgent(request)

    try {
      assertLoginRateLimit(ip)
    } catch {
      await logAuthEvent({
        eventType: 'login_rate_limited',
        email,
        ipAddress: ip,
        userAgent: ua,
        threatLevel: 'high',
      })
      return jsonError('Too many login attempts. Please try again later.', 429)
    }

    try {
      const result = await login(email, password, { ip, userAgent: ua })
      if (!result) {
        await logAuthEvent({
          eventType: 'login_failed',
          email,
          ipAddress: ip,
          userAgent: ua,
        })
        return jsonError('Invalid credentials', 401)
      }
      await logAuthEvent({
        eventType: 'login_success',
        userId: result.user.id,
        email: result.user.email,
        ipAddress: ip,
        userAgent: ua,
      })
      const user = await enrichUser({ ...result.user, permissions: result.permissions })
      return jsonOk({ ...result, user: { ...user, permissions: result.permissions } })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Login failed'
      if (message.includes('pending HR') || message.includes('not approved')) {
        await logAuthEvent({
          eventType: 'login_failed',
          email,
          ipAddress: ip,
          userAgent: ua,
          meta: { reason: message },
        })
        return jsonError(message, 403)
      }
      throw e
    }
  })
}
