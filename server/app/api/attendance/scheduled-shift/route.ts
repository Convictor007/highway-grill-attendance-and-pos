import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { scheduledShiftForEmployee } from '@/lib/attendance'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'attendance.manage')
    const url = new URL(request.url)
    const employeeId = url.searchParams.get('employee_id')
    const date = url.searchParams.get('date')
    if (!employeeId || !date) return jsonError('employee_id and date required', 422)
    return jsonOk(await scheduledShiftForEmployee(employeeId, date))
  })
}
