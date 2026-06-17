import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { createTemplate, templates } from '@/lib/shifts'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'shifts.manage')
    const branchId = new URL(request.url).searchParams.get('branch_id')
    return jsonOk(await templates(branchId))
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'shifts.manage')
    const body = (await request.json()) as Record<string, unknown>
    if (!body.branch_id || !body.name || !body.start_time || !body.end_time) {
      return jsonError('branch_id, name, start_time, end_time required', 422)
    }
    return jsonOk(await createTemplate(body), 201)
  })
}
