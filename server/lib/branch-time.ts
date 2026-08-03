/** Branch wall-clock times (schedule) vs UTC instants (Postgres TIMESTAMPTZ). */
export const DEFAULT_BRANCH_TZ = 'Asia/Manila'
export const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

/**
 * SQL expression: calendar date of a TIMESTAMPTZ column in the branch timezone.
 * Use for work-day attribution (overnight clock-outs stay on the clock-in day).
 * Pass alias-qualified column, e.g. `a.clock_in` or `clock_in`.
 */
export function sqlBranchDate(columnSql: string): string {
  return `(${columnSql} AT TIME ZONE '${DEFAULT_BRANCH_TZ}')::date`
}

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

/**
 * Manually-entered attendance time (branch wall-clock) → UTC ISO instant string.
 *
 * HR/employee correction forms send naive "YYYY-MM-DD[ T]HH:mm[:ss]" strings that
 * represent branch-local (Manila) wall-clock time. Stored straight into a
 * TIMESTAMPTZ column they would be read back as UTC (an 8h error vs. the schedule,
 * which is converted with the Manila offset), zeroing out hours and inflating
 * late/early minutes. Convert here so manual entries become real UTC instants,
 * matching `NOW()` clock-ins and `shiftWallClockToUtcMs` schedules.
 *
 * Values that already carry an explicit timezone (trailing `Z` or `±HH:MM`) or are
 * Date objects are treated as real instants and passed through, so calling this
 * more than once is safe (idempotent).
 */
export function branchWallClockToUtcIso(value: unknown, offsetMs = MANILA_OFFSET_MS): string | null {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }
  const s = String(value).trim()
  if (!s) return null
  // Already an absolute instant (explicit timezone) — keep as-is.
  if (/[zZ]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s)) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const match = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!match) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const time = `${match[2]}:${match[3]}:${match[4] ?? '00'}`
  const ms = shiftWallClockToUtcMs(match[1], time, offsetMs)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

/** Today's calendar date in branch timezone (YYYY-MM-DD). */
export function todayInBranchTz(offsetMs = MANILA_OFFSET_MS): string {
  const d = new Date(Date.now() + offsetMs)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

/** Branch-local calendar date (YYYY-MM-DD) for a clock instant (UTC TIMESTAMPTZ). */
export function clockInstantToBranchDate(value: unknown, offsetMs = MANILA_OFFSET_MS): string {
  const ms = parseClockInstant(value)
  if (Number.isNaN(ms)) return ''
  const d = new Date(ms + offsetMs)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

/** True when clock-out falls on a later branch-local day than clock-in (crossed midnight). */
export function crossedBranchMidnight(clockIn: unknown, clockOut: unknown, offsetMs = MANILA_OFFSET_MS): boolean {
  const inDate = clockInstantToBranchDate(clockIn, offsetMs)
  const outDate = clockInstantToBranchDate(clockOut, offsetMs)
  if (!inDate || !outDate) return false
  return outDate > inDate
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
