import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { promoteToRegular } from '@/lib/employees'
import { NotFoundError } from '@/lib/errors'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(_request)
    requirePermission(user, 'employees.manage')
    const { id } = await params
    const row = await promoteToRegular(id)
    if (!row) throw new NotFoundError('Employee not found')
    return jsonOk(row)
  })
}
