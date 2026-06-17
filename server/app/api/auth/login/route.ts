import { jsonError, jsonOk } from '@/lib/api-response'
import { enrichUser, login } from '@/lib/auth'
import { handleRoute } from '@/lib/route-handler'

export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = (await request.json()) as { email?: string; password?: string }
    const email = String(body.email ?? '').trim()
    const password = String(body.password ?? '')
    if (!email || !password) return jsonError('Email and password required', 422)

    try {
      const result = await login(email, password)
      if (!result) return jsonError('Invalid credentials', 401)
      const user = await enrichUser({ ...result.user, permissions: result.permissions })
      return jsonOk({ ...result, user: { ...user, permissions: result.permissions } })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Login failed'
      if (message.includes('pending HR') || message.includes('not approved')) {
        return jsonError(message, 403)
      }
      throw e
    }
  })
}
