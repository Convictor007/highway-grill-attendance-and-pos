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

export function formatDateDisplay(iso: string): string {
  if (!iso) return 'Select date'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatTimeDisplay(hhmm: string): string {
  if (!hhmm) return 'Select time'
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm
  const dt = new Date()
  dt.setHours(h, m, 0, 0)
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
