import { requireUser } from '@/lib/auth'
import { requireActiveEmployeeAccount, requirePermission } from '@/lib/auth-guard'
import { hasPermission } from '@/lib/permissions'
import { jsonError, jsonOk } from '@/lib/api-response'
import { listAttendance } from '@/lib/attendance'
import { ForbiddenError } from '@/lib/errors'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    const url = new URL(request.url)
    const date = url.searchParams.get('date')
    const branchId = url.searchParams.get('branch_id')
    if (hasPermission(user, 'attendance.view')) {
      return jsonOk(await listAttendance(date, branchId, url.searchParams.get('employee_id')))
    }
    if (hasPermission(user, 'attendance.self') && user.employee_id) {
      requireActiveEmployeeAccount(user)
      return jsonOk(await listAttendance(date, null, user.employee_id))
    }
    throw new ForbiddenError()
  })
}
