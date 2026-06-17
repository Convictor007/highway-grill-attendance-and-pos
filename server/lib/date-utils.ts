function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Calendar date in local timezone (YYYY-MM-DD). */
export function toLocalIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
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
  return toLocalIsoDate(new Date())
}

export function addDays(isoDate: string, days: number): string {
  const normalized = toIsoDateString(isoDate)
  const [y, m, d] = normalized.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return toLocalIsoDate(dt)
}

/** Sunday-based week start (matches PHP roster). */
export function normalizeWeekStartSunday(weekStart?: string | null): string {
  const base = weekStart?.trim()
    ? new Date(toIsoDateString(weekStart) + 'T12:00:00')
    : new Date()
  if (!weekStart?.trim()) {
    base.setDate(base.getDate() - base.getDay())
    return toLocalIsoDate(base)
  }
  const dow = base.getDay()
  if (dow !== 0) base.setDate(base.getDate() - dow)
  return toLocalIsoDate(base)
}

export function mondayThisWeek(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toLocalIsoDate(d)
}
