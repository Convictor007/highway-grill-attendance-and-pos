import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { review } from '@/lib/loans'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'loans.manage')
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const row = await review(id, String(body.status ?? ''), user.id)
    if (!row) return jsonError('Loan not found or not pending', 404)
    return jsonOk(row)
  })
}
