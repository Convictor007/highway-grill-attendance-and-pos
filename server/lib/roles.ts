import { getDb } from './db'

export async function listRoles(roleType?: string | null) {
  const db = getDb()
  if (roleType && ['staff', 'customer', 'system'].includes(roleType)) {
    return db`
      SELECT role_id, role_slug, role_name, description, role_type, is_system, display_order
      FROM roles
      WHERE role_type = ${roleType}
      ORDER BY display_order ASC, role_name ASC
    `
  }
  return db`
    SELECT role_id, role_slug, role_name, description, role_type, is_system, display_order
    FROM roles
    ORDER BY display_order ASC, role_name ASC
  `
}

export async function getRoleBySlug(slug: string) {
  const db = getDb()
  const rows = await db`
    SELECT role_id, role_slug, role_name, description, role_type, is_system, display_order
    FROM roles WHERE role_slug = ${slug}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function getPermissionsForRole(roleId: number) {
  const db = getDb()
  return db`
    SELECT p.permission_id, p.permission_key, p.permission_name, p.module, p.description
    FROM permissions p
    INNER JOIN role_permissions rp ON rp.permission_id = p.permission_id
    WHERE rp.role_id = ${roleId}
    ORDER BY p.module, p.permission_key
  `
}

export async function listAllPermissions() {
  const db = getDb()
  return db`
    SELECT permission_id, permission_key, permission_name, module, description
    FROM permissions
    ORDER BY module, permission_key
  `
}

export async function setPermissionsForRole(roleId: number, permissionIds: number[]) {
  const db = getDb()
  await db.begin(async (tx) => {
    await tx`DELETE FROM role_permissions WHERE role_id = ${roleId}`
    for (const pid of permissionIds) {
      if (pid > 0) {
        await tx`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES (${roleId}, ${pid})
          ON CONFLICT DO NOTHING
        `
      }
    }
  })
}
