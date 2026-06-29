import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { recomputeAttendanceBatch } from '@/lib/attendance-auto'
import { handleRoute } from '@/lib/route-handler'

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.manage')
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return jsonOk(
      await recomputeAttendanceBatch({
        branchId: body.branch_id ? String(body.branch_id) : null,
        from: body.from ? String(body.from) : null,
        to: body.to ? String(body.to) : null,
      }),
    )
  })
}
