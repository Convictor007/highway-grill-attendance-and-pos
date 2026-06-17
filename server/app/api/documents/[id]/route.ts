import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { deleteDocument } from '@/lib/documents'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'employees.manage')
    const { id } = await params
    if (!(await deleteDocument(id))) return jsonError('Document not found', 404)
    return jsonOk({})
  })
}
