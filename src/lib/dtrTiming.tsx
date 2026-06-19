import type { AttendanceRecord } from '../types/hrms'

export function formatTimingMinutes(minutes: number | string | null | undefined): string {
  const n = Number(minutes ?? 0)
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n < 60) return `${n}m`
  const h = Math.floor(n / 60)
  const m = n % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export type DtrTimingFlags = {
  earlyIn: string
  lateIn: string
  earlyOut: string
  lateOut: string
  hasAny: boolean
}

export function dtrTimingFlags(record: AttendanceRecord): DtrTimingFlags {
  const earlyIn = formatTimingMinutes(record.early_in_minutes)
  const lateIn = formatTimingMinutes(record.late_in_minutes)
  const earlyOut = formatTimingMinutes(record.early_out_minutes)
  const lateOut = formatTimingMinutes(record.late_out_minutes)
  return {
    earlyIn,
    lateIn,
    earlyOut,
    lateOut,
    hasAny: Boolean(earlyIn || lateIn || earlyOut || lateOut),
  }
}

export function dtrTimingSummary(record: AttendanceRecord): string {
  const f = dtrTimingFlags(record)
  const parts: string[] = []
  if (f.earlyIn) parts.push(`Early in ${f.earlyIn}`)
  if (f.lateIn) parts.push(`Late in ${f.lateIn}`)
  if (f.earlyOut) parts.push(`Early out ${f.earlyOut}`)
  if (f.lateOut) parts.push(`Late out ${f.lateOut}`)
  return parts.join(' · ')
}

export function DtrTimingBadges({ record }: { record: AttendanceRecord }) {
  const f = dtrTimingFlags(record)
  if (!f.hasAny) return null
  return (
    <span className="dtr-timing-badges">
      {f.earlyIn && <span className="dtr-badge dtr-badge--early">Early in {f.earlyIn}</span>}
      {f.lateIn && <span className="dtr-badge dtr-badge--late">Late in {f.lateIn}</span>}
      {f.earlyOut && <span className="dtr-badge dtr-badge--early">Early out {f.earlyOut}</span>}
      {f.lateOut && <span className="dtr-badge dtr-badge--late">Late out {f.lateOut}</span>}
    </span>
  )
}
