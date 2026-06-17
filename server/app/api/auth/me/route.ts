import { enrichUser, requireUser } from '@/lib/auth'
import { jsonOk } from '@/lib/api-response'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    return jsonOk(await enrichUser(user))
  })
}
