import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { prepareEmployee } from '@/lib/payroll'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.view')
    const url = new URL(request.url)
    const runId = url.searchParams.get('run_id')
    const employeeId = url.searchParams.get('employee_id')
    if (!runId || !employeeId) return jsonError('run_id and employee_id required', 422)
    const includedParam = url.searchParams.get('included_dates')
    const attendanceEditMode = includedParam !== null
    const includedDates =
      attendanceEditMode && includedParam !== ''
        ? includedParam.split(',').map((s) => s.trim()).filter(Boolean)
        : attendanceEditMode
          ? []
          : null
    return jsonOk(await prepareEmployee(runId, employeeId, includedDates, attendanceEditMode))
  })
}
