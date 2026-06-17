import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import {
  deleteEmployee,
  getEmployee,
  updateEmployee,
  validatePositionForBranch,
} from '@/lib/employees'
import { NotFoundError } from '@/lib/errors'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'employees.view')
    const { id } = await params
    const row = await getEmployee(id)
    if (!row) throw new NotFoundError('Employee not found')
    return jsonOk(row)
  })
}

export async function PUT(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'employees.manage')
    const { id } = await params
    const existing = await getEmployee(id)
    if (!existing) throw new NotFoundError('Employee not found')
    const body = (await request.json()) as Record<string, unknown>
    const branchId = String(body.branch_id ?? existing.branch_id)
    await validatePositionForBranch(
      branchId,
      body.department_id != null ? String(body.department_id) : (existing.department_id as string | null),
      body.position_id != null ? String(body.position_id) : (existing.position_id as string | null),
    )
    const row = await updateEmployee(id, body)
    return jsonOk(row)
  })
}

export async function DELETE(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'employees.manage')
    const { id } = await params
    const ok = await deleteEmployee(id)
    if (!ok) return jsonError('Employee not found', 404)
    return jsonOk({ ok: true })
  })
}
