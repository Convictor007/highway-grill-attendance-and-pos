import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { createAdjustment, listAdjustments } from '@/lib/payroll-adjustments'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.view')
    const url = new URL(request.url)
    const recurring = url.searchParams.get('recurring')
    const recurringOnly = recurring === '1' || recurring === 'true'
    return jsonOk(
      await listAdjustments(
        url.searchParams.get('employee_id'),
        url.searchParams.get('run_id'),
        recurringOnly ? true : null,
      ),
    )
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.manage')
    const body = (await request.json()) as Record<string, unknown>
    if (!body.employee_id || body.amount == null) {
      return jsonError('employee_id and amount required', 422)
    }
    return jsonOk(await createAdjustment(body, user.id), 201)
  })
}
