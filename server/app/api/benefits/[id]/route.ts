import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import { update, remove } from '@/lib/benefits'
import { writeAuditLog } from '@/lib/audit-log'
import { handleRoute } from '@/lib/route-handler'
import { getDb } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.manage')
    const { id } = await params
    const db = getDb()
    const beforeRows = await db`SELECT * FROM employee_benefit_enrollments WHERE id = ${id} LIMIT 1`
    const before = beforeRows[0]
    const row = await update(id, (await request.json()) as Record<string, unknown>)
    if (!row) return jsonError('Enrollment not found', 404)
    await writeAuditLog(user.id, 'update', 'employee_benefit_enrollments', id, before as Record<string, unknown>, row as Record<string, unknown>)
    return jsonOk(row)
  })
}

export async function DELETE(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.manage')
    const { id } = await params
    const db = getDb()
    const beforeRows = await db`SELECT * FROM employee_benefit_enrollments WHERE id = ${id} LIMIT 1`
    const before = beforeRows[0]
    const deleted = await remove(id)
    if (!deleted) return jsonError('Enrollment not found', 404)
    await writeAuditLog(user.id, 'delete', 'employee_benefit_enrollments', id, before as Record<string, unknown>, null)
    return jsonOk({ deleted: true })
  })
}
