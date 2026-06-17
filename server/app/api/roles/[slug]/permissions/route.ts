import { requireUser } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import {
  getPermissionsForRole,
  getRoleBySlug,
  listAllPermissions,
  setPermissionsForRole,
} from '@/lib/roles'
import { jsonError, jsonOk } from '@/lib/api-response'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ slug: string }> }

export async function GET(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    if (!hasPermission(user, 'users.manage')) return jsonError('Forbidden', 403)
    const { slug } = await params
    const role = await getRoleBySlug(slug)
    if (!role) return jsonError('Role not found', 404)
    return jsonOk({
      role,
      permissions: await getPermissionsForRole(role.role_id),
      all_permissions: await listAllPermissions(),
    })
  })
}

export async function PUT(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    if (!hasPermission(user, 'users.manage')) return jsonError('Forbidden', 403)
    const { slug } = await params
    const role = await getRoleBySlug(slug)
    if (!role) return jsonError('Role not found', 404)
    if (role.role_type === 'system') return jsonError('System roles cannot be modified', 403)

    const body = (await request.json()) as { permission_ids?: unknown }
    const ids = Array.isArray(body.permission_ids) ? body.permission_ids.map(Number) : []
    await setPermissionsForRole(role.role_id, ids)
    return jsonOk({
      role,
      permissions: await getPermissionsForRole(role.role_id),
    })
  })
}
