import { requireUser } from '@/lib/auth'
import { requireActiveEmployeeAccount, requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { defaultSummaryFrom, hoursSummary } from '@/lib/attendance'
import { todayIso } from '@/lib/date-utils'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'attendance.self')
    requireActiveEmployeeAccount(user)
    if (!user.employee_id) return jsonError('No employee linked', 422)
    const url = new URL(request.url)
    const from = url.searchParams.get('from') ?? defaultSummaryFrom()
    const to = url.searchParams.get('to') ?? todayIso()
    return jsonOk(await hoursSummary(user.employee_id, from, to))
  })
}
