import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { generatePayslips } from '@/lib/payroll'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.manage')
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const replace = Boolean(body.replace)
    return jsonOk(await generatePayslips(id, replace))
  })
}
