import { getDb } from './db'

export async function userIdForEmployee(employeeId: string): Promise<string | null> {
  const db = getDb()
  const rows = await db`
    SELECT id FROM users
    WHERE employee_id = ${employeeId} AND is_active = true
      AND account_status IN ('pending', 'active')
    LIMIT 1
  `
  return rows[0]?.id ? String(rows[0].id) : null
}

/** Active user ids whose role (or per-user override) grants a permission key. */
export async function userIdsWithPermission(permissionKey: string): Promise<string[]> {
  const db = getDb()
  const rows = await db<{ id: number }[]>`
    SELECT DISTINCT u.id
    FROM users u
    WHERE u.is_active = true
      AND u.account_status = 'active'
      AND (
        EXISTS (
          SELECT 1 FROM role_permissions rp
          INNER JOIN permissions p ON p.permission_id = rp.permission_id
          WHERE rp.role_id = u.role_id AND p.permission_key = ${permissionKey}
        )
        OR EXISTS (
          SELECT 1 FROM user_permissions up
          INNER JOIN permissions p ON p.permission_id = up.permission_id
          WHERE up.user_id = u.id AND up.grant_type = 'grant' AND p.permission_key = ${permissionKey}
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM user_permissions up
        INNER JOIN permissions p ON p.permission_id = up.permission_id
        WHERE up.user_id = u.id AND up.grant_type = 'deny' AND p.permission_key = ${permissionKey}
      )
  `
  return rows.map((r) => String(r.id))
}

/** Send the same notification to every user holding a permission. */
export async function notifyUsersWithPermission(
  permissionKey: string,
  type: string,
  title: string,
  body?: string | null,
  relatedId?: string | null,
  link?: string | null,
) {
  const ids = await userIdsWithPermission(permissionKey)
  for (const uid of ids) {
    await createNotification(uid, type, title, body, relatedId, link)
  }
}

export async function existsForRelated(userId: string, type: string, relatedId: string): Promise<boolean> {
  const db = getDb()
  const rows = await db`
    SELECT id FROM notifications
    WHERE user_id = ${userId} AND type = ${type} AND related_id = ${relatedId}
    LIMIT 1
  `
  return rows.length > 0
}

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body?: string | null,
  relatedId?: string | null,
  link?: string | null,
) {
  const db = getDb()
  const [row] = await db`
    INSERT INTO notifications (user_id, type, title, body, link, related_id)
    VALUES (${userId}, ${type}, ${title}, ${body ?? null}, ${link ?? null}, ${relatedId ?? null})
    RETURNING id
  `
  const rows = await db`SELECT * FROM notifications WHERE id = ${row.id}`
  return rows[0]
}

export async function listForUser(userId: string, unreadOnly?: boolean | null, limit = 50) {
  const lim = Math.max(1, Math.min(limit, 100))
  const db = getDb()
  if (unreadOnly) {
    return db`
      SELECT * FROM notifications
      WHERE user_id = ${userId} AND is_read = false
      ORDER BY created_at DESC
      LIMIT ${lim}
    `
  }
  return db`
    SELECT * FROM notifications
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${lim}
  `
}

export async function unreadCount(userId: string): Promise<number> {
  const db = getDb()
  const rows = await db`
    SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = ${userId} AND is_read = false
  `
  return Number(rows[0]?.c ?? 0)
}

export async function markRead(id: string, userId: string): Promise<boolean> {
  const db = getDb()
  const result = await db`
    UPDATE notifications SET is_read = true WHERE id = ${id} AND user_id = ${userId}
  `
  return result.count > 0
}

export async function markAllRead(userId: string): Promise<void> {
  const db = getDb()
  await db`UPDATE notifications SET is_read = true WHERE user_id = ${userId} AND is_read = false`
}
