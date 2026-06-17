import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { createBankAccount } from '@/lib/contracts'
import { handleRoute } from '@/lib/route-handler'

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'employees.manage')
    const body = (await request.json()) as Record<string, unknown>
    if (!body.employee_id || !body.bank_name || !body.account_no) {
      return jsonError('employee_id, bank_name, account_no required', 422)
    }
    return jsonOk(await createBankAccount(body), 201)
  })
}
