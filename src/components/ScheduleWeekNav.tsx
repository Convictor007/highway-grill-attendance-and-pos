import type { ReactNode } from 'react'
import { isCurrentWeek, shiftWeek, sundayOfWeek, weekRangeLabel } from '../lib/scheduleWeek'
import { DatePicker } from './DatePicker'

type Props = {
  weekStart: string
  onWeekStartChange: (weekStart: string) => void
  children?: ReactNode
  trailing?: ReactNode
  /** Show calendar jump (HR roster) — hidden on small screens via CSS */
  showDatePicker?: boolean
}

export function ScheduleWeekNav({
  weekStart,
  onWeekStartChange,
  children,
  trailing,
  showDatePicker = false,
}: Props) {
  const onToday = () => onWeekStartChange(sundayOfWeek())
  const onPrev = () => onWeekStartChange(shiftWeek(weekStart, -1))
  const onNext = () => onWeekStartChange(shiftWeek(weekStart, 1))

  return (
    <div className="schedule-week-nav card">
      {children && <div className="schedule-week-nav-filters">{children}</div>}

      <div className="schedule-week-nav-controls">
        <button
          type="button"
          className="schedule-week-nav-arrow"
          onClick={onPrev}
          aria-label="Previous week"
        >
          ‹
        </button>
        <div className="schedule-week-nav-range" aria-live="polite">
          {weekRangeLabel(weekStart)}
        </div>
        <button type="button" className="schedule-week-nav-arrow" onClick={onNext} aria-label="Next week">
          ›
        </button>
        {!isCurrentWeek(weekStart) && (
          <button type="button" className="btn btn-ghost schedule-week-nav-today" onClick={onToday}>
            Today
          </button>
        )}
      </div>

      {(showDatePicker || trailing) && (
        <div className="schedule-week-nav-extra">
          {showDatePicker && (
            <div className="schedule-week-nav-picker mobile-hidden">
              <DatePicker value={weekStart} onChange={(v) => v && onWeekStartChange(v)} />
            </div>
          )}
          {trailing && <div className="schedule-week-nav-trailing">{trailing}</div>}
        </div>
      )}
    </div>
  )
}
