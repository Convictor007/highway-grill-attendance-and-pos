import type { ShiftClockContext } from '../lib/clock'
import { formatClockTime, formatDurationMinutes, formatShiftTimeRange } from '../lib/timeFormat'

type Props = {
  shift: ShiftClockContext | null | undefined
  open: boolean
}

export function ShiftEndBanner({ shift, open }: Props) {
  if (!open || !shift) return null

  if (!shift.show_end_shift) return null

  const earlyDuration = formatDurationMinutes(shift.early_minutes)
  const lateDuration = formatDurationMinutes(shift.late_minutes)
  const end = formatClockTime(shift.expected_shift_end ?? shift.shift_end) || 'end of shift'
  const label = shift.shift_label ? formatShiftTimeRange(shift.shift_label) : null

  const phase = shift.phase ?? 'normal'
  const lateNote = lateDuration ? ` (9-hour duty extended due to ${lateDuration} late start)` : ''
  const earlyNote = earlyDuration ? ` (${earlyDuration} early start — finish at ${end} as scheduled)` : ''

  let message: string
  let className = 'shift-end-banner'

  if (phase === 'overdue') {
    className += ' shift-end-banner--overdue'
    message = label
      ? `Your ${label} regular duty ended at ${end}${lateNote}${earlyNote}. Extra time is overtime — tap End shift when done.`
      : `Your regular duty ended at ${end}${lateNote}${earlyNote}. Tap End shift when you finish.`
  } else {
    className += ' shift-end-banner--soon'
    const untilEnd = formatDurationMinutes(Math.max(1, shift.minutes_until_end ?? 30))
    message = label
      ? `Regular duty ends in ~${untilEnd} (${end})${lateNote}${earlyNote}. Tap End shift when you leave.`
      : `Regular duty ends in ~${untilEnd} (${end})${earlyNote}. Tap End shift when you are done.`
  }

  return (
    <div className={className} role="status">
      {message}
    </div>
  )
}
