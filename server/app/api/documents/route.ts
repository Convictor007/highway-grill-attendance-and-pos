import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { hasPermission } from '@/lib/permissions'
import { jsonError, jsonOk } from '@/lib/api-response'
import { create, forEmployee, forEmployeeHr } from '@/lib/documents'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    const employeeId = new URL(request.url).searchParams.get('employee_id')
    if (employeeId && hasPermission(user, 'employees.manage')) {
      return jsonOk(await forEmployeeHr(employeeId))
    }
    requirePermission(user, 'documents.view.self')
    if (!user.employee_id) return jsonError('No employee linked', 422)
    return jsonOk(await forEmployee(user.employee_id))
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'employees.manage')
    const body = (await request.json()) as Record<string, unknown>
    return jsonOk(await create(body, user.id), 201)
  })
}
