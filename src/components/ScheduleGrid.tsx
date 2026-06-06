import { useEffect, useRef } from 'react'
import type { RosterGrid, RosterGridCell } from '../types/hrms'

type Props = {
  data: RosterGrid | null
  loading?: boolean
  highlightEmployeeId?: string | null
  onSwapRequest?: (cell: RosterGridCell & { date: string }) => void
}

export function ScheduleGrid({ data, loading, highlightEmployeeId, onSwapRequest }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const todayColRef = useRef<HTMLTableCellElement>(null)

  useEffect(() => {
    if (!data || loading) return
    const t = window.setTimeout(() => {
      todayColRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    }, 100)
    return () => window.clearTimeout(t)
  }, [data?.week_start, loading])

  if (loading) {
    return <p className="loading-block">Loading schedule…</p>
  }

  if (!data) {
    return <p style={{ color: 'var(--muted)' }}>No schedule data.</p>
  }

  if (data.rows.length === 0) {
    return <p style={{ color: 'var(--muted)' }}>No active employees for this branch.</p>
  }

  const todayIndex = data.days.findIndex((d) => d.is_today)

  return (
    <div className="schedule-grid-wrap">
      <div className="schedule-grid-header">
        <h2 className="schedule-grid-title">Weekly schedule</h2>
        {data.branch_name && (
          <p className="schedule-grid-branch">
            {data.branch_name} · {formatWeekRange(data.week_start, data.week_end)}
          </p>
        )}
        {data.is_current_week && (
          <p className="schedule-current-week">You are viewing this week · today is {formatDayLong(data.current_date)}</p>
        )}
      </div>

      <div className="schedule-grid-scroll" ref={scrollRef}>
        <table className="schedule-grid">
          <thead>
            <tr>
              <th className="schedule-grid-name-col">Employee</th>
              {data.days.map((d, idx) => (
                <th
                  key={d.date}
                  ref={idx === todayIndex ? todayColRef : undefined}
                  className={d.is_today ? 'schedule-grid-day-head schedule-grid-day-head--today' : 'schedule-grid-day-head'}
                >
                  <span className="schedule-grid-day-label">{d.label}</span>
                  <span className="schedule-grid-day-date">{formatShortDate(d.date)}</span>
                  {d.is_today && <span className="schedule-grid-day-tag">Today</span>}
                  {!d.is_today && d.is_tomorrow && (
                    <span className="schedule-grid-day-tag">Tomorrow</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr
                key={row.employee_id}
                className={highlightEmployeeId === row.employee_id ? 'schedule-grid-row--self' : undefined}
              >
                <th scope="row" className="schedule-grid-name">
                  {row.display_name}
                  {highlightEmployeeId === row.employee_id && (
                    <span className="schedule-grid-you">You</span>
                  )}
                </th>
                {row.cells.map((cell, idx) => {
                  const day = data.days[idx]
                  const isOwn = highlightEmployeeId === row.employee_id
                  const canSwap =
                    isOwn &&
                    !cell.off &&
                    cell.assignment_id &&
                    cell.date >= (data.current_date ?? '') &&
                    onSwapRequest
                  return (
                    <td
                      key={cell.date}
                      className={[
                        day?.is_today ? 'schedule-grid-cell--today' : '',
                        cell.off ? 'schedule-grid-cell--off' : 'schedule-grid-cell--shift',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {cell.off ? (
                        'Off'
                      ) : (
                        <div className="schedule-grid-cell-inner">
                          <span>{cell.label}</span>
                          {canSwap && (
                            <button
                              type="button"
                              className="schedule-swap-btn"
                              onClick={() => onSwapRequest({ ...cell, date: cell.date })}
                            >
                              Swap
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.footnotes.length > 0 && (
        <p className="schedule-grid-footnotes">
          {data.footnotes.map((f) => `${f.day_label}: ${f.text}`).join(' · ')}
        </p>
      )}
    </div>
  )
}

function formatWeekRange(start: string, end: string) {
  const s = new Date(start + 'T12:00:00')
  const e = new Date(end + 'T12:00:00')
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, { ...opts, year: 'numeric' })}`
}

function formatShortDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
}

function formatDayLong(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}
