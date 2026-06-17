import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { create, list } from '@/lib/holidays'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.view')
    const url = new URL(request.url)
    const yearRaw = url.searchParams.get('year')
    return jsonOk(await list(url.searchParams.get('branch_id'), yearRaw ? Number(yearRaw) : null))
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.manage')
    const body = (await request.json()) as Record<string, unknown>
    if (!body.holiday_date || !body.name) return jsonError('holiday_date and name required', 422)
    return jsonOk(await create(body), 201)
  })
}
