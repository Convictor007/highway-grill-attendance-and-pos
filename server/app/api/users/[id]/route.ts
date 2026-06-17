import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { getUser, updateUser } from '@/lib/users'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'users.manage')
    const { id } = await params
    return jsonOk(await getUser(id))
  })
}

export async function PUT(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'users.manage')
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    return jsonOk(await updateUser(id, body))
  })
}
