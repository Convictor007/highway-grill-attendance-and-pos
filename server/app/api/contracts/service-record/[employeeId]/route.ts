import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { hasPermission } from '@/lib/permissions'
import { jsonOk } from '@/lib/api-response'
import { serviceRecord } from '@/lib/contracts'
import { ForbiddenError } from '@/lib/errors'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ employeeId: string }> }

export async function GET(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    const { employeeId } = await params
    if (!hasPermission(user, 'employees.view') && user.employee_id !== employeeId) {
      requirePermission(user, 'documents.view.self')
      if (user.employee_id !== employeeId) throw new ForbiddenError()
    }
    return jsonOk(await serviceRecord(employeeId))
  })
}
