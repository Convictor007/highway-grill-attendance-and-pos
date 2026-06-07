import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { formatTimeDisplay, toLocalDateTimeInput } from '../lib/datetime'

export type ScheduledShiftPayload = {
  assignment_id: string
  shift_name: string | null
  shift_date: string
  start_time: string
  end_time: string
  break_mins: number
  clock_in: string
  clock_out: string
  suggested_hours: number
  off_day: boolean
}

type Props = {
  employeeId: string
  date: string
  onApply: (shift: ScheduledShiftPayload) => void
}

export function ScheduleShiftBanner({ employeeId, date, onApply }: Props) {
  const [shift, setShift] = useState<ScheduledShiftPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!employeeId || !date) {
      setShift(null)
      return
    }
    setLoading(true)
    setError(null)
    api<ScheduledShiftPayload | null>(
      `/attendance/scheduled-shift?employee_id=${encodeURIComponent(employeeId)}&date=${encodeURIComponent(date)}`
    )
      .then((row) => setShift(row))
      .catch(() => {
        setShift(null)
        setError('Could not load schedule')
      })
      .finally(() => setLoading(false))
  }, [employeeId, date])

  if (loading) {
    return <p className="muted-block schedule-shift-banner">Loading work schedule…</p>
  }

  if (error) return null

  if (!shift) {
    return (
      <div className="schedule-shift-banner schedule-shift-banner--empty card">
        <strong>No shift on roster</strong>
        <p className="muted-block" style={{ margin: '0.35rem 0 0' }}>
          No published assignment for {date}. Assign shifts under Shifts → Roster, or enter times manually.
        </p>
      </div>
    )
  }

  if (shift.off_day) {
    return (
      <div className="schedule-shift-banner schedule-shift-banner--off card">
        <strong>Scheduled OFF</strong>
        <p className="muted-block" style={{ margin: '0.35rem 0 0' }}>
          This employee has no working shift on {date}.
        </p>
      </div>
    )
  }

  const start = formatTimeDisplay(shift.start_time.slice(0, 5))
  const end = formatTimeDisplay(shift.end_time.slice(0, 5))

  return (
    <div className="schedule-shift-banner card">
      <div className="schedule-shift-banner-head">
        <div>
          <strong>Work schedule — {shift.shift_name ?? 'Assigned shift'}</strong>
          <p className="muted-block" style={{ margin: '0.25rem 0 0' }}>
            {start} – {end}
            {shift.break_mins > 0 && ` · ${shift.break_mins} min break`}
            {' · '}
            {shift.suggested_hours.toFixed(2)}h
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => onApply(shift)}
        >
          Apply schedule
        </button>
      </div>
    </div>
  )
}

export function applyScheduledShiftToForm(shift: ScheduledShiftPayload): {
  clockIn: string
  clockOut: string
  actualHours: string
  assignmentId: string
} {
  return {
    clockIn: toLocalDateTimeInput(shift.clock_in),
    clockOut: toLocalDateTimeInput(shift.clock_out),
    actualHours: String(shift.suggested_hours),
    assignmentId: shift.assignment_id,
  }
}
