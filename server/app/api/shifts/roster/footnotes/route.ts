import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { ensureSchedule, updateSchedule } from '@/lib/shifts'
import { handleRoute } from '@/lib/route-handler'

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'shifts.manage')
    const body = (await request.json()) as Record<string, unknown>
    if (!body.branch_id || !body.week_start || !('day_footnotes' in body)) {
      return jsonError('branch_id, week_start, and day_footnotes required', 422)
    }
    const schedule = await ensureSchedule(String(body.branch_id), String(body.week_start), user.id)
    return jsonOk(
      await updateSchedule(String(schedule.id), { day_footnotes: body.day_footnotes }, user.id),
    )
  })
}
