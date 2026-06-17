import { getDb } from './db'

export async function forBranch(branchId?: string | null) {
  const db = getDb()
  if (branchId) {
    return db`
      SELECT a.* FROM announcements a
      WHERE (a.branch_id IS NULL OR a.branch_id = ${branchId})
        AND (a.publish_at IS NULL OR a.publish_at <= NOW())
        AND (a.expires_at IS NULL OR a.expires_at >= NOW())
      ORDER BY CASE a.priority WHEN 'urgent' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
        a.publish_at DESC NULLS LAST
      LIMIT 20
    `
  }
  return db`
    SELECT a.* FROM announcements a
    WHERE (a.publish_at IS NULL OR a.publish_at <= NOW())
      AND (a.expires_at IS NULL OR a.expires_at >= NOW())
    ORDER BY CASE a.priority WHEN 'urgent' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
      a.publish_at DESC NULLS LAST
    LIMIT 20
  `
}

export async function listAll() {
  const db = getDb()
  return db`
    SELECT a.*, b.name AS branch_name FROM announcements a
    LEFT JOIN branches b ON b.id = a.branch_id
    ORDER BY a.publish_at DESC NULLS LAST
    LIMIT 100
  `
}

export async function get(id: string) {
  const db = getDb()
  const rows = await db`
    SELECT a.*, b.name AS branch_name FROM announcements a
    LEFT JOIN branches b ON b.id = a.branch_id WHERE a.id = ${id} LIMIT 1
  `
  return rows[0] ?? null
}

export async function create(data: Record<string, unknown>, userId: string) {
  const branchId = data.branch_id != null && data.branch_id !== '' ? String(data.branch_id) : null
  let priority = String(data.priority ?? 'normal')
  if (!['low', 'normal', 'urgent'].includes(priority)) priority = 'normal'
  const db = getDb()
  const [row] = await db`
    INSERT INTO announcements (branch_id, title, body, priority, posted_by, publish_at, expires_at)
    VALUES (${branchId}, ${String(data.title).trim()}, ${String(data.body ?? '').trim()}, ${priority},
      ${userId}, ${data.publish_at ? String(data.publish_at) : new Date().toISOString()},
      ${data.expires_at ? String(data.expires_at) : null})
    RETURNING id
  `
  return get(String(row.id))
}

export async function update(id: string, data: Record<string, unknown>) {
  const existing = await get(id)
  if (!existing) return null
  const branchId = 'branch_id' in data
    ? (data.branch_id != null && data.branch_id !== '' ? String(data.branch_id) : null)
    : existing.branch_id ? String(existing.branch_id) : null
  let priority = String(data.priority ?? existing.priority)
  if (!['low', 'normal', 'urgent'].includes(priority)) priority = String(existing.priority)
  const db = getDb()
  await db`
    UPDATE announcements SET branch_id = ${branchId}, title = ${String(data.title ?? existing.title).trim()},
      body = ${String(data.body ?? existing.body).trim()}, priority = ${priority},
      publish_at = ${data.publish_at ?? existing.publish_at},
      expires_at = ${'expires_at' in data ? (data.expires_at ?? null) : existing.expires_at}
    WHERE id = ${id}
  `
  return get(id)
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  const db = getDb()
  const result = await db`DELETE FROM announcements WHERE id = ${id}`
  return result.count > 0
}
