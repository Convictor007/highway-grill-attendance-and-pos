import postgres from 'postgres'
import { env } from './env'

let sql: ReturnType<typeof postgres> | null = null

export function getDb() {
  if (sql) return sql
  const url = env('DATABASE_URL')
  if (!url) {
    throw new Error('DATABASE_URL is not set')
  }
  sql = postgres(url, {
    ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : 'require',
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  })
  return sql
}

/** Nullable integer FK from API / form values. */
export function nullableInt(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

export function toIntId(value: unknown): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) throw new Error('Invalid id')
  return n
}
