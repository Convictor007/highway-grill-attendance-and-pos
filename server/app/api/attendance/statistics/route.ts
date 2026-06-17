import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { statistics } from '@/lib/attendance'
import { todayIso } from '@/lib/date-utils'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'attendance.view')
    const url = new URL(request.url)
    const from = url.searchParams.get('from') ?? todayIso().slice(0, 8) + '01'
    const to = url.searchParams.get('to') ?? todayIso()
    return jsonOk(await statistics(url.searchParams.get('branch_id'), from, to))
  })
}
