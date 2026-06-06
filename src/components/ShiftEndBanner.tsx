import type { ShiftClockContext } from '../lib/clock'

type Props = {
  shift: ShiftClockContext | null | undefined
  open: boolean
}

export function ShiftEndBanner({ shift, open }: Props) {
  if (!open || !shift?.show_end_shift) return null

  const phase = shift.phase ?? 'normal'
  const end = shift.shift_end ?? 'end of shift'
  const label = shift.shift_label

  let message: string
  let className = 'shift-end-banner'

  if (phase === 'overdue') {
    className += ' shift-end-banner--overdue'
    message = label
      ? `Your ${label} shift ended at ${end}. Tap End shift when you finish duty.`
      : `Your shift has ended. Tap End shift when you finish duty.`
  } else {
    className += ' shift-end-banner--soon'
    const mins = Math.max(1, shift.minutes_until_end ?? 30)
    message = label
      ? `Shift ${label} ends in ~${mins} min (${end}). Ready to leave? Tap End shift.`
      : `Your shift ends in ~${mins} minutes. Tap End shift when you are done.`
  }

  return (
    <div className={className} role="status">
      {message}
    </div>
  )
}
