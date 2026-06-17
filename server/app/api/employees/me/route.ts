import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { getEmployee, updateEmployeeSelf } from '@/lib/employees'
import { NotFoundError } from '@/lib/errors'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    if (!user.employee_id) throw new NotFoundError('No employee profile linked')
    const row = await getEmployee(user.employee_id)
    if (!row) throw new NotFoundError('Employee not found')
    return jsonOk(row)
  })
}

export async function PUT(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'profile.edit.self')
    if (!user.employee_id) throw new NotFoundError('No employee profile linked')
    const body = (await request.json()) as Record<string, unknown>
    const row = await updateEmployeeSelf(user.employee_id, body)
    if (!row) throw new NotFoundError('Employee not found')
    return jsonOk(row)
  })
}
