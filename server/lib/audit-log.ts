import { getDb } from './db'

export async function writeAuditLog(
  userId: string | null,
  action: string,
  tableName: string,
  recordId?: string | number | null,
  oldData?: Record<string, unknown> | null,
  newData?: Record<string, unknown> | null,
  ipAddress?: string | null,
) {
  const db = getDb()
  await db`
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data, ip_address)
    VALUES (
      ${userId ? Number(userId) : null},
      ${action},
      ${tableName},
      ${recordId != null && recordId !== '' ? Number(recordId) : null},
      ${oldData ? db.json(oldData) : null},
      ${newData ? db.json(newData) : null},
      ${ipAddress ?? null}
    )
  `
}
