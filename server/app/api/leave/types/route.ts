import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { createType, types } from '@/lib/leave'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'leave.view')
    return jsonOk(await types())
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'leave.manage')
    const body = (await request.json()) as Record<string, unknown>
    if (!body.name) return jsonError('name required', 422)
    return jsonOk(await createType(body), 201)
  })
}
