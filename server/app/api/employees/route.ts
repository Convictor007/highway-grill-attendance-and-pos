import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import {
  createEmployee,
  listEmployees,
  validatePositionForBranch,
} from '@/lib/employees'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'employees.view')
    const url = new URL(request.url)
    return jsonOk(
      await listEmployees(url.searchParams.get('branch_id'), url.searchParams.get('status')),
    )
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'employees.manage')
    const body = (await request.json()) as Record<string, unknown>
    if (!body.branch_id || !body.emp_number || !body.first_name || !body.last_name) {
      return jsonError('branch_id, emp_number, first_name, last_name required', 422)
    }
    await validatePositionForBranch(
      String(body.branch_id),
      body.department_id ? String(body.department_id) : null,
      body.position_id ? String(body.position_id) : null,
    )
    return jsonOk(await createEmployee(body), 201)
  })
}
