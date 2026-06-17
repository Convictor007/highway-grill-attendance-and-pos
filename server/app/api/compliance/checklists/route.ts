import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { checklists, createChecklist } from '@/lib/compliance'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'compliance.view')
    return jsonOk(await checklists())
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'compliance.view')
    const body = (await request.json()) as Record<string, unknown>
    return jsonOk(await createChecklist(body), 201)
  })
}
