import type { AttendanceRecord } from '../types/hrms'
import { formatDurationMinutes } from './timeFormat'

export function formatTimingMinutes(minutes: number | string | null | undefined): string {
  return formatDurationMinutes(minutes)
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
