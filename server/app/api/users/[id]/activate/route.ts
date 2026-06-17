import { requireUser } from '@/lib/auth'
import { requireCrewApproval } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { activateEmployee } from '@/lib/users'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requireCrewApproval(user)
    const { id } = await params
    return jsonOk(await activateEmployee(id, user.id))
  })
}
