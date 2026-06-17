import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import * as fieldWork from '@/lib/field-work'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'attendance.manage')
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    return jsonOk(await fieldWork.updateSite(id, body))
  })
}

export async function DELETE(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'attendance.manage')
    const { id } = await params
    await fieldWork.deleteSite(id)
    return jsonOk({ deleted: true })
  })
}
