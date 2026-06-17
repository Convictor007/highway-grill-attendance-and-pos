import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { generatePayslipForEmployee } from '@/lib/payroll'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.manage')
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    if (!body.employee_id) return jsonError('employee_id required', 422)
    return jsonOk(
      await generatePayslipForEmployee(id, String(body.employee_id), {
        included_dates: body.included_dates,
        overrides: body.overrides ?? {},
      }),
    )
  })
}
