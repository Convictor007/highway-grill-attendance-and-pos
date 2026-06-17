import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { getAttendance, updateAttendance } from '@/lib/attendance'
import { NotFoundError } from '@/lib/errors'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'attendance.view')
    const { id } = await params
    const row = await getAttendance(id)
    if (!row) throw new NotFoundError('Record not found')
    return jsonOk(row)
  })
}

export async function PUT(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'attendance.manage')
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const row = await updateAttendance(id, body, user.id)
    if (!row) return jsonError('Record not found', 404)
    return jsonOk(row)
  })
}
