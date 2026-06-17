import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { addAssignment, assignments } from '@/lib/shifts'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'shifts.manage')
    const scheduleId = new URL(request.url).searchParams.get('schedule_id')
    return jsonOk(await assignments(scheduleId))
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'shifts.manage')
    const body = (await request.json()) as Record<string, unknown>
    return jsonOk(await addAssignment(body), 201)
  })
}
