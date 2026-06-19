export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Calendar date in the user's local timezone (YYYY-MM-DD). */
export function toLocalIsoDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function todayLocalIsoDate(): string {
  return toLocalIsoDate()
}

/** Normalize shift_date from API (DATE string or ISO datetime) to YYYY-MM-DD in local calendar. */
export function normalizeShiftDate(value: unknown): string {
  if (value == null || value === '') return ''
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s.includes('T') ? s : `${s}T12:00:00`)
  if (!Number.isNaN(d.getTime())) return toLocalIsoDate(d)
  const match = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : ''
}

export function formatDateDisplay(iso: string): string {
  if (!iso) return 'Select date'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const dt = new Date(y, m - 1, d)
  if (Number.isNaN(dt.getTime())) return iso
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

/** Normalize DB/API time values to HH:mm for inputs and display. */
export function normalizeTimeInput(raw: unknown): string {
  if (raw == null || raw === '') return '09:00'
  const s = String(raw).trim()
  const match = s.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return '09:00'
  const h = Math.min(23, Math.max(0, parseInt(match[1], 10)))
  const m = Math.min(59, Math.max(0, parseInt(match[2], 10)))
  return `${pad2(h)}:${pad2(m)}`
}

export function formatTimeDisplay(hhmm: string): string {
  const normalized = normalizeTimeInput(hhmm)
  const [h, m] = normalized.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return 'Select time'
  const dt = new Date()
  dt.setHours(h, m, 0, 0)
  if (Number.isNaN(dt.getTime())) return normalized
  return dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function toLocalDateTimeInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function toSqlDateTime(local: string): string | null {
  if (!local) return null
  return local.replace('T', ' ') + (local.length === 16 ? ':00' : '')
}

export function splitDateTime(local: string): { date: string; time: string } {
  if (!local || !local.includes('T')) return { date: local || '', time: '09:00' }
  const [date, time] = local.split('T')
  return { date, time: time.slice(0, 5) }
}

export function joinDateTime(date: string, time: string): string {
  if (!date) return ''
  return `${date}T${time || '00:00'}`
}

export function dateFromIsoDateTime(iso: string): string {
  return splitDateTime(toLocalDateTimeInput(iso)).date
}
