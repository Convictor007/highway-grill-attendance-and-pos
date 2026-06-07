import { useEffect, useRef } from 'react'
import type { RosterGrid, RosterGridCell } from '../types/hrms'

export type ScheduleCellEditPayload = {
  employeeId: string
  employeeName: string
  date: string
  dateLabel: string
  cell: RosterGridCell
}

type Props = {
  data: RosterGrid | null
  loading?: boolean
  highlightEmployeeId?: string | null
  editable?: boolean
  /** Employee roster: unassigned days show as Day off, not + */
  employeeView?: boolean
  /** When false, hide Swap links in the grid (employee swap mode toggle) */
  showSwapButtons?: boolean
  onEditCell?: (payload: ScheduleCellEditPayload) => void
  onSwapRequest?: (cell: RosterGridCell & { date: string }) => void
}

function cellStatus(cell: RosterGridCell): 'working' | 'day_off' | 'unset' {
  if (cell.status) return cell.status
  if (cell.off && cell.assignment_id) return 'day_off'
  if (!cell.off && cell.assignment_id) return 'working'
  return 'unset'
}

function displayStatus(
  cell: RosterGridCell,
  employeeView: boolean
): 'working' | 'day_off' | 'unset' {
  const status = cellStatus(cell)
  if (employeeView && status === 'unset') return 'day_off'
  return status
}

export function ScheduleGrid({
  data,
  loading,
  highlightEmployeeId,
  editable,
  employeeView = false,
  showSwapButtons = false,
  onEditCell,
  onSwapRequest,
}: Props) {
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
  const canEdit = editable && data.editable !== false

  const openCell = (row: (typeof data.rows)[0], cell: RosterGridCell) => {
    if (!canEdit || !onEditCell) return
    onEditCell({
      employeeId: row.employee_id,
      employeeName: row.display_name,
      date: cell.date,
      dateLabel: formatDayLong(cell.date),
      cell,
    })
  }

  return (
    <div className="schedule-grid-wrap">
      <div className="schedule-grid-scroll" ref={scrollRef}>
        <table className="schedule-grid">
          <thead>
            <tr>
              <th className="schedule-grid-name-col">Employee</th>
              {data.days.map((d, idx) => (
                <th
                  key={d.date}
                  ref={idx === todayIndex ? todayColRef : undefined}
                  className={[
                    'schedule-grid-day-head',
                    d.is_today ? 'schedule-grid-day-head--today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="schedule-grid-day-label">{d.label}</span>
                  <span className="schedule-grid-day-date">{formatShortDate(d.date)}</span>
                  {d.is_today && <span className="schedule-grid-day-tag schedule-grid-day-tag--today">Today</span>}
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
                  const status = displayStatus(cell, employeeView)
                  const isOwn = highlightEmployeeId === row.employee_id
                  const canSwap =
                    showSwapButtons &&
                    isOwn &&
                    status === 'working' &&
                    cell.assignment_id &&
                    cell.date >= (data.current_date ?? '') &&
                    onSwapRequest

                  const tdClass = [
                    day?.is_today ? 'schedule-grid-cell--today' : '',
                    status === 'working' ? 'schedule-grid-cell--shift' : '',
                    status === 'day_off' ? 'schedule-grid-cell--off' : '',
                    status === 'unset' ? 'schedule-grid-cell--unset' : '',
                    canEdit ? 'schedule-grid-cell--clickable' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')

                  return (
                    <td
                      key={cell.date}
                      className={tdClass}
                      onClick={canEdit ? () => openCell(row, cell) : undefined}
                      onKeyDown={
                        canEdit
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                openCell(row, cell)
                              }
                            }
                          : undefined
                      }
                      role={canEdit ? 'button' : undefined}
                      tabIndex={canEdit ? 0 : undefined}
                      title={canEdit ? 'Tap to set work hours or rest day' : undefined}
                    >
                      <div className="schedule-grid-cell-inner">
                        {status === 'working' && <span className="schedule-cell-hours">{cell.label}</span>}
                        {status === 'day_off' && <span className="schedule-cell-rest">Day off</span>}
                        {status === 'unset' && <span className="schedule-cell-unset">+</span>}
                        {canSwap && (
                          <button
                            type="button"
                            className="schedule-swap-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              onSwapRequest({ ...cell, date: cell.date })
                            }}
                          >
                            Swap
                          </button>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatShortDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
}

function formatDayLong(iso: string) {
  if (!iso) return ''
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}
