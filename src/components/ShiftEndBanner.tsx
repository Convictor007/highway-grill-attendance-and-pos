import type { ShiftClockContext } from '../lib/clock'

type Props = {
  shift: ShiftClockContext | null | undefined
  open: boolean
}

export function ShiftEndBanner({ shift, open }: Props) {
  if (!open || !shift) return null

  const earlyMins = shift.early_minutes ?? 0
  const end = shift.expected_shift_end ?? shift.shift_end ?? 'end of shift'
  const label = shift.shift_label

  if (earlyMins > 0 && !shift.show_end_shift) {
    return (
      <div className="shift-end-banner shift-end-banner--early" role="status">
        {label
          ? `Clocked in ${earlyMins} min early for ${label}. Regular duty still ends at ${end} — overtime only after that.`
          : `Clocked in ${earlyMins} min early. Regular duty still ends at ${end}.`}
      </div>
    )
  }

  if (!shift.show_end_shift) return null

  const phase = shift.phase ?? 'normal'
  const lateNote =
    (shift.late_minutes ?? 0) > 0
      ? ` (9h duty extended due to ${shift.late_minutes} min late start)`
      : ''
  const earlyNote =
    earlyMins > 0 ? ` (${earlyMins} min early start — finish at ${end} as scheduled)` : ''

  let message: string
  let className = 'shift-end-banner'

  if (phase === 'overdue') {
    className += ' shift-end-banner--overdue'
    message = label
      ? `Your ${label} regular duty ended at ${end}${lateNote}${earlyNote}. Extra time is overtime — tap End shift when done.`
      : `Your regular duty ended at ${end}${lateNote}${earlyNote}. Tap End shift when you finish.`
  } else {
    className += ' shift-end-banner--soon'
    const mins = Math.max(1, shift.minutes_until_end ?? 30)
    message = label
      ? `Regular duty ends in ~${mins} min (${end})${lateNote}${earlyNote}. Tap End shift when you leave.`
      : `Regular duty ends in ~${mins} minutes (${end})${earlyNote}. Tap End shift when you are done.`
  }

  return (
    <div className={className} role="status">
      {message}
    </div>
  )
}
