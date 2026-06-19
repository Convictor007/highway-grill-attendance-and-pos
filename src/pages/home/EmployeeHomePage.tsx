import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import {
  clockIn as doClockIn,
  clockOut as doClockOut,
  clockErrorMessage,
  fetchClockStatus,
  type ClockStatus,
  type ShiftClockContext,
} from '../../lib/clock'
import { resolveClockOpenState } from '../../lib/clockState'
import { CLOCK_GEOFENCE_POLICY } from '../../lib/clockPolicy'
import { formatClockTime } from '../../lib/timeFormat'
import { todayLocalIsoDate, toLocalIsoDate, normalizeShiftDate } from '../../lib/datetime'
import { ShiftEndBanner } from '../../components/ShiftEndBanner'
import { reverseGeocode } from '../../lib/geocode'
import { useAuth } from '../../context/AuthContext'
import { canUseEmployeeFeatures } from '../../lib/accountStatus'
import { ClockGeofenceBanner } from '../../components/ClockGeofenceBanner'
import { ClockLocationModal } from '../../components/ClockLocationModal'
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

interface TodayScheduledShift {
  assignment_id: string
  shift_name: string | null
  shift_date: string
  start_time: string
  end_time: string
  off_day: boolean
}

function formatTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso.replace(' ', 'T'))
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function workDateFromClockIn(clockIn: string) {
  return clockIn.slice(0, 10)
}

export function EmployeeHomePage() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [onBreak, setOnBreak] = useState(false)
  const [busy, setBusy] = useState(false)
  const [weekHours, setWeekHours] = useState<HoursSummary | null>(null)
  const [todayShift, setTodayShift] = useState<MyShift | null>(null)
  const [recent, setRecent] = useState<AttendanceRecord[]>([])
  const [weekOtHours, setWeekOtHours] = useState(0)
  const [now, setNow] = useState(new Date())
  const [clockError, setClockError] = useState<string | null>(null)
  const [currentAddress, setCurrentAddress] = useState<string | null>(null)
  const [geofenceRequired, setGeofenceRequired] = useState(false)
  const [mobileClock, setMobileClock] = useState(false)
  const [positionLabel, setPositionLabel] = useState<string | null>(null)
  const [shiftCtx, setShiftCtx] = useState<ShiftClockContext | null>(null)
  const [locationMapOpen, setLocationMapOpen] = useState(false)

  const name = user?.employee?.first_name ?? 'there'
  const canClock = canUseEmployeeFeatures(user) && Boolean(user?.employee_id)
  const geofence = useClockGeofence(geofenceRequired, { sessionActive: open && canClock })
  const showEndShift = open && !!shiftCtx?.show_end_shift
  const today = todayLocalIsoDate()

  const refresh = async () => {
    const to = todayLocalIsoDate()
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - 6)
    const from = toLocalIsoDate(fromDate)
    const [status, summary, shifts, scheduledToday, history] = await Promise.all([
      fetchClockStatus().catch((): ClockStatus => ({ open: false, on_break: false })),
      api<HoursSummary>('/attendance/summary').catch(() => null),
      api<MyShift[]>(`/shifts/my?from=${today}&to=${today}`).catch(() => [] as MyShift[]),
      api<TodayScheduledShift | null>(`/attendance/scheduled-shift?date=${today}`).catch(() => null),
      api<AttendanceRecord[]>(`/attendance/history?from=${from}&to=${to}`).catch(() => [] as AttendanceRecord[]),
    ])
    const clock = resolveClockOpenState(status, history)
    setOpen(clock.open)
    setOnBreak(clock.onBreak)
    if (clock.open) setClockError(null)
    setGeofenceRequired(!!status.geofence_required)
    setMobileClock(!!status.mobile_clock)
    setPositionLabel(status.position_label ?? null)
    setShiftCtx(status.shift ?? null)
    setWeekHours(summary)
    const shiftToday =
      shifts.find((s) => normalizeShiftDate(s.shift_date) === today) ??
      (scheduledToday && !scheduledToday.off_day
        ? {
            id: scheduledToday.assignment_id,
            shift_date: normalizeShiftDate(scheduledToday.shift_date),
            start_time: scheduledToday.start_time,
            end_time: scheduledToday.end_time,
            shift_name: scheduledToday.shift_name,
          }
        : null)
    setTodayShift(shiftToday)
    setRecent(history)
    setWeekOtHours(
      history.reduce((sum, r) => sum + (r.overtime_hours != null ? Number(r.overtime_hours) : 0), 0)
    )
  }

  useEffect(() => {
    refresh()
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const vicinity = useVicinityMonitor({
    enabled: open && canClock,
    geofenceRequired,
    onAutoClockOut: () => {
      refresh()
    },
    onLocationPing: (coords) => {
      void geofence.updateFromCoords(coords)
    },
  })

  useEffect(() => {
    const coords = geofence.lastCoords
    if (!coords) {
      setCurrentAddress(null)
      return
    }
    reverseGeocode(coords.latitude, coords.longitude)
      .then((geo) => setCurrentAddress(geo.short))
      .catch(() => setCurrentAddress(null))
  }, [geofence.lastCoords])

  const handleClockIn = async () => {
    if (!canClock) return
    setBusy(true)
    setClockError(null)
    try {
      await doClockIn(geofenceRequired)
      await geofence.refresh()
      await refresh()
    } catch (err) {
      const msg = clockErrorMessage(err)
      if (/already clocked/i.test(msg)) {
        await refresh()
      } else {
        setClockError(msg)
      }
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
  const scheduleShift =
    todayShift ??
    (shiftCtx?.has_shift && shiftCtx.shift_start && shiftCtx.shift_end
      ? {
          id: 'status',
          shift_date: today,
          start_time: shiftCtx.shift_start,
          end_time: shiftCtx.shift_end,
          shift_name: shiftCtx.shift_label ?? 'Scheduled',
        }
      : null)

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
          required={geofenceRequired}
          mobileClock={mobileClock}
          positionLabel={positionLabel}
          sessionActive={open}
          loading={geofence.loading}
          inside={geofence.inside}
          siteName={geofence.siteName}
          locationDenied={geofence.locationDenied}
          locationError={geofence.locationError}
          checkedOnce={geofence.checkedOnce}
          nearestSiteName={geofence.nearestSiteName}
          nearestDistanceM={geofence.nearestDistanceM}
          vicinity={vicinity}
          onRequestLocation={() => {
            setClockError(null)
            void geofence.requestLocation()
          }}
          requesting={geofence.requesting}
        />
        <ShiftEndBanner shift={shiftCtx} open={open} />
        {open && geofenceRequired && (
          <p className="muted-block clock-policy-note">{CLOCK_GEOFENCE_POLICY}</p>
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
        {canClock && (
          <button
            type="button"
            className="btn btn-ghost btn-sm clock-location-trigger"
            onClick={() => setLocationMapOpen(true)}
          >
            ⊕ View live GPS map
          </button>
        )}
        {weekHours && (
          <p className="clock-week-total">
            Total this week: <strong>{weekHours.total_hours.toFixed(1)} hrs</strong>
            {weekOtHours > 0 && (
              <span className="muted-inline">
                {' '}
                · OT <strong>{weekOtHours.toFixed(2)} hrs</strong>
              </span>
            )}
            <span className="muted-inline"> · {weekHours.shift_count} entries</span>
          </p>
        )}
      </section>

      <ClockLocationModal
        open={locationMapOpen}
        onClose={() => setLocationMapOpen(false)}
        geofenceRequired={geofenceRequired}
      />

      <section className="card home-section">
        <div className="home-section-head">
          <h2>Today&apos;s schedule</h2>
          <Link to="/scheduling" className="text-link">View all</Link>
        </div>
        {scheduleShift ? (
          <dl className="schedule-dl">
            <div>
              <dt>Date</dt>
              <dd>{formatDate(normalizeShiftDate(scheduleShift.shift_date))}</dd>
            </div>
            <div>
              <dt>Shift</dt>
              <dd>{scheduleShift.shift_name ?? 'Scheduled'}</dd>
            </div>
            <div>
              <dt>Time in</dt>
              <dd>{formatClockTime(scheduleShift.start_time)}</dd>
            </div>
            <div>
              <dt>Time out</dt>
              <dd>{formatClockTime(scheduleShift.end_time)}</dd>
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
            {recent.map((r) => (
                <li key={r.id} className="dtr-row">
                  <div className="dtr-row-date">
                    <span className="dtr-day">{formatDate(workDateFromClockIn(r.clock_in))}</span>
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
                    {r.overtime_hours != null && Number(r.overtime_hours) > 0 && (
                      <span className="dtr-row-ot">OT {Number(r.overtime_hours).toFixed(2)}h</span>
                    )}
                  </div>
                </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
