import { getDb } from './db'

export type SqlValue = string | number | boolean | null | Date

export async function unsafe<T = Record<string, unknown>>(query: string, params: SqlValue[] = []): Promise<T[]> {
  const db = getDb()
  return db.unsafe(query, params) as Promise<T[]>
}

export async function unsafeExec(query: string, params: SqlValue[] = []): Promise<number> {
  const db = getDb()
  const result = await db.unsafe(query, params)
  return result.count
}
