import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { hasPermission } from '@/lib/permissions'
import { jsonError, jsonOk } from '@/lib/api-response'
import { get, payments, recordPayment } from '@/lib/loans'
import { ForbiddenError } from '@/lib/errors'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    if (!hasPermission(user, 'loans.self') && !hasPermission(user, 'loans.manage')) {
      throw new ForbiddenError()
    }
    const { id } = await params
    const loan = await get(id)
    if (!loan) return jsonError('Loan not found', 404)
    if (!hasPermission(user, 'loans.manage') && user.employee_id !== String(loan.employee_id)) {
      throw new ForbiddenError()
    }
    return jsonOk(await payments(id))
  })
}

export async function POST(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'loans.manage')
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    if (!body.amount) return jsonError('amount required', 422)
    const row = await recordPayment(id, body)
    if (!row) return jsonError('Loan not found or not active', 404)
    return jsonOk(row, 201)
  })
}
