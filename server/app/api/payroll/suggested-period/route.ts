import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { suggested } from '@/lib/payroll-period'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.view')
    const which = new URL(request.url).searchParams.get('which') === 'next' ? 'next' : 'current'
    return jsonOk(suggested(which))
  })
}
