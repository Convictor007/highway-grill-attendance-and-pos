import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { createPosition, listPositions } from '@/lib/settings'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'employees.view')
    const url = new URL(request.url)
    return jsonOk(
      await listPositions(url.searchParams.get('department_id'), url.searchParams.get('branch_id')),
    )
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'settings.departments.manage')
    const body = (await request.json()) as Record<string, unknown>
    if (!body.department_id || !body.title) return jsonError('department_id and title required', 422)
    return jsonOk(await createPosition(body), 201)
  })
}
