import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import * as fieldWork from '@/lib/field-work'
import { getDb } from '@/lib/db'
import { handleRoute } from '@/lib/route-handler'

async function resolveBranchId(user: { employee_id?: string | null }, queryBranch?: string | null) {
  if (queryBranch) return queryBranch
  if (!user.employee_id) return null
  const db = getDb()
  const rows = await db`SELECT branch_id FROM employees WHERE id = ${user.employee_id} LIMIT 1`
  return rows[0]?.branch_id ? String(rows[0].branch_id) : null
}

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'attendance.self')
    const url = new URL(request.url)
    const lat = url.searchParams.get('latitude')
    const lng = url.searchParams.get('longitude')
    if (lat == null || lng == null) return jsonError('latitude and longitude are required', 422)
    const branchId = await resolveBranchId(user, url.searchParams.get('branch_id'))
    const clockInOnly = url.searchParams.get('clock_in_only') === '1'
    const accuracyRaw = url.searchParams.get('accuracy_m') ?? url.searchParams.get('accuracy')
    const accuracyM = accuracyRaw ? Number(accuracyRaw) : null
    return jsonOk(await fieldWork.zoneStatus(Number(lat), Number(lng), branchId, clockInOnly, accuracyM))
  })
}
