import { requireUser } from '@/lib/auth'
import { requireActiveEmployeeAccount, requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { scheduledShiftForEmployee } from '@/lib/attendance'
import { handleRoute } from '@/lib/route-handler'
import { todayInBranchTz } from '@/lib/branch-time'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    const url = new URL(request.url)
    const dateParam = url.searchParams.get('date')
    const employeeParam = url.searchParams.get('employee_id')

    if (employeeParam) {
      requirePermission(user, 'attendance.manage')
      const date = dateParam ?? todayInBranchTz()
      return jsonOk(await scheduledShiftForEmployee(employeeParam, date))
    }

    requirePermission(user, 'attendance.self')
    requireActiveEmployeeAccount(user)
    if (!user.employee_id) return jsonError('No employee linked', 422)
    const date = dateParam ?? todayInBranchTz()
    return jsonOk(await scheduledShiftForEmployee(user.employee_id, date))
  })
}
