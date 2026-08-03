import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { attendanceAuditLogs } from '@/lib/compliance'
import { handleRoute } from '@/lib/route-handler'

/** GET /api/attendance/audit — HR audit trail for corrections and time edits. */
export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'attendance.view')
    const url = new URL(request.url)
    const limitRaw = url.searchParams.get('limit')
    const parsed = limitRaw ? Number(limitRaw) : 100
    const limit = Number.isFinite(parsed) ? parsed : 100
    const action = url.searchParams.get('action')
    return jsonOk(await attendanceAuditLogs(limit, action))
  })
}
