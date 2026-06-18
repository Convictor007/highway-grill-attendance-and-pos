import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { getEmployee, updateEmployee, validatePositionForBranch } from '@/lib/employees'
import { NotFoundError } from '@/lib/errors'
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
    const profile = body.profile as Record<string, unknown> | undefined
    const userData = { ...body }
    delete userData.profile

    const updated = await updateUser(id, userData)

    if (profile && Object.keys(profile).length > 0) {
      const employeeId = updated.employee_id ?? userData.employee_id
      if (!employeeId) throw new NotFoundError('No employee record linked to this login')
      const employeeIdStr = String(employeeId)
      const existing = await getEmployee(employeeIdStr)
      if (!existing) throw new NotFoundError('Employee not found')

      const branchId = String(profile.branch_id ?? existing.branch_id)
      await validatePositionForBranch(
        branchId,
        profile.department_id != null ? String(profile.department_id) : (existing.department_id as string | null),
        profile.position_id != null ? String(profile.position_id) : (existing.position_id as string | null),
      )

      const row = await updateEmployee(employeeIdStr, profile)
      if (!row) throw new NotFoundError('Employee not found')
    }

    return jsonOk(await getUser(id))
  })
}
