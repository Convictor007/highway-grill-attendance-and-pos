/** Branch wall-clock times (schedule) vs UTC instants (Postgres TIMESTAMPTZ). */
export const DEFAULT_BRANCH_TZ = 'Asia/Manila'
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Postgres DATE or API string → YYYY-MM-DD (UTC calendar parts for DATE columns). */
export function normalizeCalendarDate(value: unknown): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`
  }
  const s = String(value ?? '').trim()
  const match = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : s.slice(0, 10)
}

/** Local shift wall time (e.g. 15:00 on 2026-06-19 in Manila) → UTC epoch ms. */
export function shiftWallClockToUtcMs(dateYmd: string, timeHms: string, offsetMs = MANILA_OFFSET_MS): number {
  const [y, m, d] = normalizeCalendarDate(dateYmd).split('-').map(Number)
  const parts = String(timeHms).slice(0, 8).split(':').map(Number)
  const hh = parts[0] ?? 0
  const mm = parts[1] ?? 0
  const ss = parts[2] ?? 0
  return Date.UTC(y, m - 1, d, hh, mm, ss) - offsetMs
}

/** Today's calendar date in branch timezone (YYYY-MM-DD). */
export function todayInBranchTz(offsetMs = MANILA_OFFSET_MS): string {
  const d = new Date(Date.now() + offsetMs)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

/** Parse attendance TIMESTAMPTZ (UTC instant) from DB Date or ISO string. */
export function parseClockInstant(value: unknown): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const s = String(value ?? '').trim()
  if (!s) return NaN
  if (/[zZ]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s)) {
    return new Date(s).getTime()
  }
  const normalized = s.includes('T') ? s : s.replace(' ', 'T')
  return new Date(`${normalized}Z`).getTime()
}
