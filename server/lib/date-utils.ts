import { MANILA_OFFSET_MS } from './branch-time'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Convert an epoch-ms instant to a Manila calendar date (YYYY-MM-DD). */
function msToManilaDate(ms: number): string {
  const d = new Date(ms + MANILA_OFFSET_MS)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

/** Calendar date in Manila timezone (YYYY-MM-DD). */
export function toLocalIsoDate(d: Date): string {
  return msToManilaDate(d.getTime())
}

/** Normalize Postgres DATE, JS Date, or string to YYYY-MM-DD. */
export function toIsoDateString(value: unknown): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new RangeError('Invalid time value')
    return toLocalIsoDate(value)
  }
  const s = String(value ?? '').trim()
  const match = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return match[1]
  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) return toLocalIsoDate(parsed)
  throw new RangeError('Invalid time value')
}

export function todayIso(): string {
  return msToManilaDate(Date.now())
}

export function addDays(isoDate: string, days: number): string {
  const normalized = toIsoDateString(isoDate)
  const [y, m, d] = normalized.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const resultMs = dt.getTime() + days * 86_400_000
  return msToManilaDate(resultMs)
}

/** Sunday-based week start (matches PHP roster). */
export function normalizeWeekStartSunday(weekStart?: string | null): string {
  if (weekStart?.trim()) {
    const d = new Date(toIsoDateString(weekStart) + 'T12:00:00Z')
    const dow = d.getUTCDay()
    if (dow !== 0) d.setUTCDate(d.getUTCDate() - dow)
    return msToManilaDate(d.getTime())
  }
  const nowMs = Date.now()
  const d = new Date(nowMs + MANILA_OFFSET_MS)
  const dow = d.getUTCDay()
  const offset = dow === 0 ? 0 : -dow
  return msToManilaDate(nowMs + offset * 86_400_000)
}

export function mondayThisWeek(): string {
  const nowMs = Date.now()
  const d = new Date(nowMs + MANILA_OFFSET_MS)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  return msToManilaDate(nowMs + diff * 86_400_000)
}
