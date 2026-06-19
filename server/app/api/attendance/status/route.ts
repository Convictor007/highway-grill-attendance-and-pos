import { requireUser } from '@/lib/auth'
import { requireActiveEmployeeAccount, requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { clockPolicyForEmployee, openSession } from '@/lib/attendance'
import * as auto from '@/lib/attendance-auto'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'attendance.self')
    requireActiveEmployeeAccount(user)
    if (!user.employee_id) return jsonOk({ open: false })
    const open = await openSession(user.employee_id)
    const onBreak = Boolean(open?.break_start && !open?.break_end)
    const policy = await clockPolicyForEmployee(user.employee_id)
    let shift = null
    if (open) {
      try {
        shift = await auto.shiftContextForEmployee(user.employee_id)
      } catch {
        shift = null
      }
    }
    return jsonOk({
      open: open != null,
      on_break: onBreak,
      session: open,
      geofence_required: policy.geofence_required,
      mobile_clock: policy.mobile_clock ?? false,
      position_label: policy.position_label ?? null,
      shift,
    })
  })
}
