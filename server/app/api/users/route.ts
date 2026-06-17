import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { createUser, listUsers } from '@/lib/users'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'users.manage')
    return jsonOk(await listUsers())
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'users.manage')
    const body = (await request.json()) as Record<string, unknown>
    return jsonOk(await createUser(body), 201)
  })
}
