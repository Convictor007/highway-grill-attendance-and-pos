import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { deleteAnnouncement, get, update } from '@/lib/announcements'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'employees.manage')
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    if (!body.title || !body.body) return jsonError('title and body required', 422)
    const row = await update(id, body)
    if (!row) return jsonError('Announcement not found', 404)
    return jsonOk(row)
  })
}

export async function DELETE(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'employees.manage')
    const { id } = await params
    const existing = await get(id)
    if (!existing) return jsonError('Announcement not found', 404)
    await deleteAnnouncement(id)
    return jsonOk({ deleted: true })
  })
}
