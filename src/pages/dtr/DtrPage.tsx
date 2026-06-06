import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import {
  clockIn as doClockIn,
  clockOut as doClockOut,
  clockErrorMessage,
  type ShiftClockContext,
} from '../../lib/clock'
import { ShiftEndBanner } from '../../components/ShiftEndBanner'
import { useAuth } from '../../context/AuthContext'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmptyState } from '../../components/EmptyState'
import { DtrLocationLink } from '../../components/DtrLocationLink'
import { ClockGeofenceBanner } from '../../components/ClockGeofenceBanner'
import { useClockGeofence } from '../../hooks/useClockGeofence'
import { useVicinityMonitor } from '../../hooks/useVicinityMonitor'
import type { AttendanceRecord } from '../../types/hrms'

interface HoursSummary {
  from: string
  to: string
  total_hours: number
  shift_count: number
}

function formatTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso.replace(' ', 'T')).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatDateLabel(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function rangeDays(from: Date, count: number): string[] {
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(from)
    d.setDate(from.getDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

export function DtrPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [clockError, setClockError] = useState<string | null>(null)
  const canClock = Boolean(user?.employee_id)
  const [rows, setRows] = useState<{ date: string; records: AttendanceRecord[] }[]>([])
  const [summary, setSummary] = useState<HoursSummary | null>(null)
  const [open, setOpen] = useState(false)
  const [onBreak, setOnBreak] = useState(false)
  const [geofenceRequired, setGeofenceRequired] = useState(false)
  const [busy, setBusy] = useState(false)
  const [shiftCtx, setShiftCtx] = useState<ShiftClockContext | null>(null)
  const geofence = useClockGeofence(geofenceRequired)
  const showEndShift = open && !!shiftCtx?.show_end_shift

  const load = async () => {
    setLoading(true)
    try {
      const monday = new Date()
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
      const dates = rangeDays(new Date(), 14)
      const [status, weekSum, ...lists] = await Promise.all([
        api<{ open: boolean; on_break?: boolean; geofence_required?: boolean; shift?: ShiftClockContext | null }>(
          '/attendance/status'
        ),
        api<HoursSummary>('/attendance/summary'),
        ...dates.map((date) =>
          api<AttendanceRecord[]>(`/attendance?date=${date}`).then((records) => ({ date, records }))
        ),
      ])
      setOpen(status.open)
      setOnBreak(!!status.on_break)
      setGeofenceRequired(!!status.geofence_required)
      setShiftCtx(status.shift ?? null)
      setSummary(weekSum)
      setRows(lists.filter((x) => x.records.length > 0))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useVicinityMonitor({
    enabled: open && canClock,
    geofenceRequired,
    onAutoClockOut: () => {
      load()
    },
  })

  const handleClockIn = async () => {
    if (!canClock) return
    setBusy(true)
    setClockError(null)
    try {
      await doClockIn()
      await geofence.refresh()
      await load()
    } catch (err) {
      setClockError(clockErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleClockOut = async () => {
    if (!canClock) return
    setBusy(true)
    setClockError(null)
    try {
      await doClockOut()
      await load()
    } catch (err) {
      setClockError(clockErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleBreakStart = async () => {
    if (!canClock || !open) return
    setBusy(true)
    setClockError(null)
    try {
      await api('/attendance/break-start', { method: 'POST', body: '{}' })
      await load()
    } catch (err) {
      setClockError(clockErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleBreakEnd = async () => {
    if (!canClock || !open) return
    setBusy(true)
    setClockError(null)
    try {
      await api('/attendance/break-end', { method: 'POST', body: '{}' })
      await load()
    } catch (err) {
      setClockError(clockErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="DTR" subtitle="In, out, and hours worked" />

      <div className="card dtr-summary-bar">
        <div>
          <span className="dtr-summary-label">This week</span>
          <strong className="dtr-summary-value">
            {summary ? `${summary.total_hours.toFixed(1)} hrs` : '—'}
          </strong>
        </div>
        <div className="clock-actions clock-actions-inline">
          {!open ? (
            <button
              type="button"
              className="btn btn-clock-in btn-sm"
              disabled={busy || !canClock || !geofence.canClockIn || geofence.loading}
              onClick={handleClockIn}
            >
              Clock in
            </button>
          ) : (
            <>
              {!onBreak ? (
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy || !canClock} onClick={handleBreakStart}>
                  Start break
                </button>
              ) : (
                <button type="button" className="btn btn-primary btn-sm" disabled={busy || !canClock} onClick={handleBreakEnd}>
                  End break
                </button>
              )}
              {showEndShift && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm btn-end-shift"
                  disabled={busy || onBreak || !canClock}
                  onClick={handleClockOut}
                >
                  End shift
                </button>
              )}
              <button
                type="button"
                className="btn btn-clock-out btn-sm"
                disabled={busy || onBreak || !canClock}
                onClick={handleClockOut}
              >
                Clock out
              </button>
            </>
          )}
        </div>
        <ClockGeofenceBanner
          required={geofenceRequired && !open}
          loading={geofence.loading}
          inside={geofence.inside}
          siteName={geofence.siteName}
          locationDenied={geofence.locationDenied}
        />
        <ShiftEndBanner shift={shiftCtx} open={open} />
        {open && geofenceRequired && (
          <p className="muted-block clock-policy-note" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
            Auto clock-out outside the zone only after 9 hours from shift start or past midnight.
          </p>
        )}
        {clockError && <p className="error-msg" style={{ marginTop: '0.5rem' }}>{clockError}</p>}
      </div>

      <div className="card table-wrap">
        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState title="No records" description="Your clock in/out history will appear here." />
        ) : (
          <table className="dtr-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time in</th>
                <th>Time out</th>
                <th>Hours</th>
                <th>OT</th>
                <th>Location (in)</th>
              </tr>
            </thead>
            <tbody>
              {rows.flatMap(({ date, records }) =>
                records.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDateLabel(date)}</td>
                    <td>{formatTime(r.clock_in)}</td>
                    <td>{formatTime(r.clock_out)}</td>
                    <td>{r.actual_hours != null ? Number(r.actual_hours).toFixed(2) : '—'}</td>
                    <td>
                      {r.overtime_hours != null && Number(r.overtime_hours) > 0
                        ? Number(r.overtime_hours).toFixed(2)
                        : '—'}
                    </td>
                    <td>
                      <DtrLocationLink
                        latitude={r.latitude}
                        longitude={r.longitude}
                        address={r.clock_in_address}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
