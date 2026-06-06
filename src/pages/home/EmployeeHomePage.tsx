import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import {
  clockIn as doClockIn,
  clockOut as doClockOut,
  clockErrorMessage,
  fetchClockStatus,
  type ShiftClockContext,
} from '../../lib/clock'
import { ShiftEndBanner } from '../../components/ShiftEndBanner'
import { reverseGeocode } from '../../lib/geocode'
import { getCurrentPosition } from '../../lib/geolocation'
import { useAuth } from '../../context/AuthContext'
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

interface MyShift {
  id: string
  shift_date: string
  start_time: string
  end_time: string
  shift_name: string | null
}

function formatTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso.replace(' ', 'T'))
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function lastNDates(n: number): string[] {
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

export function EmployeeHomePage() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [onBreak, setOnBreak] = useState(false)
  const [busy, setBusy] = useState(false)
  const [weekHours, setWeekHours] = useState<HoursSummary | null>(null)
  const [todayShift, setTodayShift] = useState<MyShift | null>(null)
  const [recent, setRecent] = useState<{ date: string; records: AttendanceRecord[] }[]>([])
  const [now, setNow] = useState(new Date())
  const [clockError, setClockError] = useState<string | null>(null)
  const [currentAddress, setCurrentAddress] = useState<string | null>(null)
  const [geofenceRequired, setGeofenceRequired] = useState(false)
  const [shiftCtx, setShiftCtx] = useState<ShiftClockContext | null>(null)
  const geofence = useClockGeofence(geofenceRequired)
  const showEndShift = open && !!shiftCtx?.show_end_shift

  const name = user?.employee?.first_name ?? 'there'
  const canClock = Boolean(user?.employee_id)
  const today = new Date().toISOString().slice(0, 10)

  const refresh = async () => {
    const [status, summary, shifts, ...dayLists] = await Promise.all([
      fetchClockStatus().catch(() => ({ open: false, on_break: false })),
      api<HoursSummary>('/attendance/summary').catch(() => null),
      api<MyShift[]>('/shifts/my').catch(() => [] as MyShift[]),
      ...lastNDates(7).map((date) =>
        api<AttendanceRecord[]>(`/attendance?date=${date}`)
          .then((records) => ({ date, records }))
          .catch(() => ({ date, records: [] as AttendanceRecord[] }))
      ),
    ])
    setOpen(status.open)
    setOnBreak(!!status.on_break)
    setGeofenceRequired(!!status.geofence_required)
    setShiftCtx(status.shift ?? null)
    setWeekHours(summary)
    const shiftToday = shifts.find((s) => s.shift_date === today) ?? null
    setTodayShift(shiftToday)
    setRecent(dayLists.filter((d) => d.records.length > 0))
  }

  useEffect(() => {
    refresh()
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useVicinityMonitor({
    enabled: open && canClock,
    geofenceRequired,
    onAutoClockOut: () => {
      refresh()
    },
  })

  useEffect(() => {
    if (!canClock) return
    getCurrentPosition().then(async (coords) => {
      if (!coords) return
      try {
        const geo = await reverseGeocode(coords.latitude, coords.longitude)
        setCurrentAddress(geo.short)
      } catch {
        setCurrentAddress(null)
      }
    })
  }, [canClock])

  const handleClockIn = async () => {
    if (!canClock) return
    setBusy(true)
    setClockError(null)
    try {
      await doClockIn()
      await geofence.refresh()
      await refresh()
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
      await refresh()
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
      await refresh()
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
      await refresh()
    } catch (err) {
      setClockError(clockErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const statusLabel = onBreak ? 'On break' : open ? 'Clocked in' : 'Clocked out'
  const statusClass = onBreak ? 'status-break' : open ? 'status-in' : 'status-out'

  return (
    <div className="employee-home">
      <header className="home-greeting">
        <h1>Hello, {name}</h1>
        <p className="home-greeting-sub">{statusLabel}</p>
      </header>

      {!canClock && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: 'var(--danger)' }}>
          <p className="error-msg" style={{ margin: 0 }}>
            Your login is not linked to an employee record. Ask HR to link your user under Users, then sign in again.
          </p>
        </div>
      )}

      <section className="clock-card card">
        <p className="clock-live" aria-live="polite">
          {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
        <p className={`clock-status-pill ${statusClass}`}>{statusLabel}</p>
        {currentAddress && (
          <p className="geo-address-line muted-block" style={{ marginBottom: '0.75rem' }}>
            {currentAddress}
          </p>
        )}
        <ClockGeofenceBanner
          required={geofenceRequired && !open}
          loading={geofence.loading}
          inside={geofence.inside}
          siteName={geofence.siteName}
          locationDenied={geofence.locationDenied}
        />
        <ShiftEndBanner shift={shiftCtx} open={open} />
        {open && geofenceRequired && (
          <p className="muted-block clock-policy-note">
            Auto clock-out outside the zone only after 9 hours from shift start or past midnight.
          </p>
        )}
        {clockError && <p className="error-msg">{clockError}</p>}
        <div className="clock-actions">
          {!open ? (
            <button
              type="button"
              className="btn btn-clock-in"
              disabled={busy || !canClock || !geofence.canClockIn || geofence.loading}
              onClick={handleClockIn}
            >
              Clock in
            </button>
          ) : (
            <>
              {!onBreak ? (
                <button type="button" className="btn btn-ghost" disabled={busy || !canClock} onClick={handleBreakStart}>
                  Start break
                </button>
              ) : (
                <button type="button" className="btn btn-primary" disabled={busy || !canClock} onClick={handleBreakEnd}>
                  End break
                </button>
              )}
              {showEndShift && (
                <button
                  type="button"
                  className="btn btn-primary btn-end-shift"
                  disabled={busy || onBreak || !canClock}
                  onClick={handleClockOut}
                >
                  End shift
                </button>
              )}
              <button type="button" className="btn btn-clock-out" disabled={busy || onBreak || !canClock} onClick={handleClockOut}>
                Clock out
              </button>
            </>
          )}
        </div>
        {weekHours && (
          <p className="clock-week-total">
            Total this week: <strong>{weekHours.total_hours.toFixed(1)} hrs</strong>
            <span className="muted-inline"> · {weekHours.shift_count} entries</span>
          </p>
        )}
      </section>

      <section className="card home-section">
        <div className="home-section-head">
          <h2>Today&apos;s schedule</h2>
          <Link to="/scheduling" className="text-link">View all</Link>
        </div>
        {todayShift ? (
          <dl className="schedule-dl">
            <div>
              <dt>Date</dt>
              <dd>{formatDate(todayShift.shift_date)}</dd>
            </div>
            <div>
              <dt>Shift</dt>
              <dd>{todayShift.shift_name ?? 'Scheduled'}</dd>
            </div>
            <div>
              <dt>Time in</dt>
              <dd>{todayShift.start_time?.slice(0, 5)}</dd>
            </div>
            <div>
              <dt>Time out</dt>
              <dd>{todayShift.end_time?.slice(0, 5)}</dd>
            </div>
          </dl>
        ) : (
          <p className="muted-block">No shift scheduled for today. Check Scheduling for your roster.</p>
        )}
      </section>

      <section className="card home-section">
        <div className="home-section-head">
          <h2>Recent time entries</h2>
          <Link to="/dtr" className="text-link">Full DTR</Link>
        </div>
        {recent.length === 0 ? (
          <p className="muted-block">No clock records yet this week.</p>
        ) : (
          <ul className="dtr-list">
            {recent.map(({ date, records }) =>
              records.map((r) => (
                <li key={r.id} className="dtr-row">
                  <div className="dtr-row-date">
                    <span className="dtr-day">{formatDate(date)}</span>
                  </div>
                  <div className="dtr-row-times">
                    <span>
                      <small>In</small> {formatTime(r.clock_in)}
                    </span>
                    <span>
                      <small>Out</small> {formatTime(r.clock_out)}
                    </span>
                  </div>
                  <div className="dtr-row-hours">
                    {r.actual_hours != null ? `${Number(r.actual_hours).toFixed(1)}h` : open && !r.clock_out ? '…' : '—'}
                  </div>
                </li>
              ))
            )}
          </ul>
        )}
      </section>
    </div>
  )
}
