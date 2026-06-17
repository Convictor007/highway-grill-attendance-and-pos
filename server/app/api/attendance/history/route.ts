import { requireUser } from '@/lib/auth'
import { requireActiveEmployeeAccount, requirePermission } from '@/lib/auth-guard'
import { hasPermission } from '@/lib/permissions'
import { jsonError, jsonOk } from '@/lib/api-response'
import { defaultHistoryFrom, employeeHistory } from '@/lib/attendance'
import { todayIso } from '@/lib/date-utils'
import { ForbiddenError } from '@/lib/errors'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    const url = new URL(request.url)
    const from = url.searchParams.get('from') ?? defaultHistoryFrom()
    const to = url.searchParams.get('to') ?? todayIso()
    if (hasPermission(user, 'attendance.view')) {
      const eid = url.searchParams.get('employee_id')
      if (!eid) return jsonError('employee_id required', 422)
      return jsonOk(await employeeHistory(eid, from, to))
    }
    if (hasPermission(user, 'attendance.self') && user.employee_id) {
      requireActiveEmployeeAccount(user)
      return jsonOk(await employeeHistory(user.employee_id, from, to))
    }
    throw new ForbiddenError()
  })
}
