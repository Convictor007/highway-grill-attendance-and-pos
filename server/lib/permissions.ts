import { getDb } from './db'

export async function permissionsForUser(roleId: number, userId: string): Promise<string[]> {
  const db = getDb()
  const roleRows = await db<{ permission_key: string }[]>`
    SELECT p.permission_key
    FROM permissions p
    INNER JOIN role_permissions rp ON rp.permission_id = p.permission_id
    WHERE rp.role_id = ${roleId}
  `
  const keys = roleRows.map((r) => r.permission_key)

  const overrides = await db<{ permission_key: string; grant_type: string }[]>`
    SELECT p.permission_key, up.grant_type
    FROM user_permissions up
    INNER JOIN permissions p ON p.permission_id = up.permission_id
    WHERE up.user_id = ${userId}
  `

  for (const row of overrides) {
    if (row.grant_type === 'deny') {
      const idx = keys.indexOf(row.permission_key)
      if (idx >= 0) keys.splice(idx, 1)
    } else if (!keys.includes(row.permission_key)) {
      keys.push(row.permission_key)
    }
  }

  return [...new Set(keys)]
}

export function hasPermission(user: { permissions?: string[] }, key: string): boolean {
  return (user.permissions ?? []).includes(key)
}
