import type { AttendanceRecord } from '../types/hrms'
import { formatDurationMinutes } from './timeFormat'

export function formatTimingMinutes(minutes: number | string | null | undefined): string {
  return formatDurationMinutes(minutes)
}

export type DtrTimingFlags = {
  earlyIn: string
  lateIn: string
  earlyOut: string
  hasAny: boolean
}

export function dtrTimingFlags(record: AttendanceRecord): DtrTimingFlags {
  const earlyIn = formatTimingMinutes(record.early_in_minutes)
  const lateIn = formatTimingMinutes(record.late_in_minutes)
  const earlyOut = formatTimingMinutes(record.early_out_minutes)
  return {
    earlyIn,
    lateIn,
    earlyOut,
    hasAny: Boolean(earlyIn || lateIn || earlyOut),
  }
}

export function dtrTimingSummary(record: AttendanceRecord): string {
  const f = dtrTimingFlags(record)
  const parts: string[] = []
  if (f.earlyIn) parts.push(`Early in ${f.earlyIn}`)
  if (f.lateIn) parts.push(`Late in ${f.lateIn}`)
  if (f.earlyOut) parts.push(`Early out ${f.earlyOut}`)
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
    </span>
  )
}
