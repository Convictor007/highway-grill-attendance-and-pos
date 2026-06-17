import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { hasPermission } from '@/lib/permissions'
import { jsonError, jsonOk } from '@/lib/api-response'
import * as fieldWork from '@/lib/field-work'
import { ForbiddenError } from '@/lib/errors'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') ?? 30)
    if (hasPermission(user, 'attendance.view')) {
      return jsonOk(
        await fieldWork.branchCheckins(
          url.searchParams.get('branch_id'),
          limit,
          url.searchParams.get('date'),
        ),
      )
    }
    requirePermission(user, 'attendance.self')
    if (!user.employee_id) return jsonError('No employee linked', 422)
    return jsonOk(await fieldWork.myCheckins(user.employee_id, limit))
  })
}

export async function POST() {
  return handleRoute(async () => {
    throw new ForbiddenError('Off-site check-in is not available. Restaurant staff must clock in at the branch.')
  })
}
