import { bearerToken, logout } from '@/lib/auth'
import { jsonOk } from '@/lib/api-response'
import { handleRoute } from '@/lib/route-handler'

export async function POST(request: Request) {
  return handleRoute(async () => {
    await logout(bearerToken(request))
    return jsonOk({ ok: true })
  })
}
