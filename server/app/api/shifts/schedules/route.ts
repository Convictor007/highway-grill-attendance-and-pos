import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { createSchedule, schedules } from '@/lib/shifts'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'shifts.manage')
    const branchId = new URL(request.url).searchParams.get('branch_id')
    return jsonOk(await schedules(branchId))
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'shifts.manage')
    const body = (await request.json()) as Record<string, unknown>
    return jsonOk(await createSchedule(body, user.id), 201)
  })
}
