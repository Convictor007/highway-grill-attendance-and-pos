import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { auditLogs } from '@/lib/compliance'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'compliance.view')
    const limitRaw = new URL(request.url).searchParams.get('limit')
    const limit = limitRaw ? Number(limitRaw) : 100
    return jsonOk(await auditLogs(limit))
  })
}
