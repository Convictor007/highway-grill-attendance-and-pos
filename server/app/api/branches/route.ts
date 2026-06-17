import { requireUser } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { getDb } from '@/lib/db'
import { jsonError, jsonOk } from '@/lib/api-response'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    if (!hasPermission(user, 'employees.view')) return jsonError('Forbidden', 403)
    const db = getDb()
    const rows = await db`
      SELECT id, name, address, phone, is_active, default_latitude, default_longitude
      FROM branches WHERE is_active = true ORDER BY name
    `
    return jsonOk(rows)
  })
}
