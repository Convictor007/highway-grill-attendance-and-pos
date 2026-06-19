import type { ShiftClockContext } from '../lib/clock'
import { formatTimingMinutes } from './dtrTiming'

type Props = {
  shift: ShiftClockContext | null | undefined
  open: boolean
}

/** Live clock-in timing only — short badges, no policy paragraphs. */
export function ShiftEndBanner({ shift, open }: Props) {
  if (!open || !shift) return null

  const early = shift.early_minutes ?? 0
  const late = shift.late_minutes ?? 0
  if (early <= 0 && late <= 0) return null

  return (
    <div className="dtr-timing-badges shift-end-banner" role="status" style={{ marginTop: '0.5rem' }}>
      {early > 0 && (
        <span className="dtr-badge dtr-badge--early">Early in {formatTimingMinutes(early)}</span>
      )}
      {late > 0 && (
        <span className="dtr-badge dtr-badge--late">Late in {formatTimingMinutes(late)}</span>
      )}
    </div>
  )
}
