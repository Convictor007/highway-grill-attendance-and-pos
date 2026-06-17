import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { deleteHoliday, get, update } from '@/lib/holidays'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.view')
    const { id } = await params
    const row = await get(id)
    if (!row) return jsonError('Holiday not found', 404)
    return jsonOk(row)
  })
}

export async function PUT(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.manage')
    const { id } = await params
    const row = await update(id, (await request.json()) as Record<string, unknown>)
    if (!row) return jsonError('Holiday not found', 404)
    return jsonOk(row)
  })
}

export async function DELETE(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.manage')
    const { id } = await params
    if (!(await deleteHoliday(id))) return jsonError('Holiday not found', 404)
    return jsonOk({})
  })
}
