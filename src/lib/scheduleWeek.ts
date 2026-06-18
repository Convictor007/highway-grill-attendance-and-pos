import { toLocalIsoDate } from './datetime'

/** Sunday of the week containing `date` (YYYY-MM-DD). */
export function sundayOfWeek(date = new Date()): string {
  const d = new Date(date)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return toLocalIsoDate(d)
}

export function shiftWeek(start: string, deltaWeeks: number): string {
  const d = new Date(start + 'T12:00:00')
  d.setDate(d.getDate() + deltaWeeks * 7)
  return toLocalIsoDate(d)
}

export function weekEndSundayStart(weekStart: string): string {
  const d = new Date(weekStart + 'T12:00:00')
  d.setDate(d.getDate() + 6)
  return toLocalIsoDate(d)
}

export function isCurrentWeek(weekStart: string): boolean {
  return weekStart === sundayOfWeek()
}

/** e.g. "Jun 14 – Jun 20, 2026" */
export function weekRangeLabel(weekStart: string): string {
  const start = new Date(weekStart + 'T12:00:00')
  const end = new Date(weekEndSundayStart(weekStart) + 'T12:00:00')
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return weekStart
  const sameYear = start.getFullYear() === end.getFullYear()
  const startFmt = start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  const endFmt = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${startFmt} – ${endFmt}`
}
