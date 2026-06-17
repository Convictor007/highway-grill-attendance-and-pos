import { listRoles } from '@/lib/roles'
import { jsonOk } from '@/lib/api-response'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const roleType = new URL(request.url).searchParams.get('role_type')
    return jsonOk(await listRoles(roleType))
  })
}
