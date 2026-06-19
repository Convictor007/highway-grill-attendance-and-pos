import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import {
  clockErrorMessage,
  fetchClockStatus,
  type ShiftClockContext,
} from '../../lib/clock'
import { ShiftEndBanner } from '../../components/ShiftEndBanner'
import { ClockActions } from '../../components/ClockActions'
import { reverseGeocode } from '../../lib/geocode'
import { useAuth } from '../../context/AuthContext'
import { canUseEmployeeFeatures } from '../../lib/accountStatus'
import { ClockGeofenceBanner } from '../../components/ClockGeofenceBanner'
import { ClockLocationModal } from '../../components/ClockLocationModal'
import { useClockGeofence } from '../../hooks/useClockGeofence'
import { useVicinityMonitor } from '../../hooks/useVicinityMonitor'
import type { AttendanceRecord } from '../../types/hrms'
import { DtrTimingBadges } from '../../lib/dtrTiming'

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
  notes?: string | null
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
  const [sessionClockIn, setSessionClockIn] = useState<string | null>(null)
  const [locationMapOpen, setLocationMapOpen] = useState(false)

  const name = user?.employee?.first_name ?? 'there'
  const canClock = canUseEmployeeFeatures(user) && Boolean(user?.employee_id)
  const geofence = useClockGeofence(geofenceRequired, { sessionActive: open && canClock })
  const today = new Date().toISOString().slice(0, 10)
  const todayAssignment = todayShift
  const isRestDay = todayAssignment?.notes === 'REST_DAY'
  const noShiftToday = !todayAssignment

  const refresh = async () => {
    const to = new Date().toISOString().slice(0, 10)
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - 6)
    const from = fromDate.toISOString().slice(0, 10)
    const [status, summary, shifts, history] = await Promise.all([
      fetchClockStatus().catch(() => ({ open: false, on_break: false })),
      api<HoursSummary>('/attendance/summary').catch(() => null),
      api<MyShift[]>('/shifts/my').catch(() => [] as MyShift[]),
      api<AttendanceRecord[]>(`/attendance/history?from=${from}&to=${to}`).catch(() => [] as AttendanceRecord[]),
    ])
    setOpen(status.open)
    setOnBreak(!!status.on_break)
    setGeofenceRequired(!!status.geofence_required)
    setMobileClock(!!status.mobile_clock)
    setPositionLabel(status.position_label ?? null)
    setShiftCtx(status.shift ?? null)
    setSessionClockIn(status.session?.clock_in ?? null)
    setWeekHours(summary)
    const shiftToday = shifts.find((s) => s.shift_date === today) ?? null
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
        <ClockActions
          open={open}
          onBreak={onBreak}
          clockInAt={sessionClockIn}
          busy={busy}
          setBusy={setBusy}
          canClock={canClock}
          geofenceRequired={geofenceRequired}
          geofenceCanClockIn={geofence.canClockIn}
          geofenceLoading={geofence.loading}
          isRestDay={isRestDay}
          noShiftToday={noShiftToday}
          onRefresh={refresh}
          onGeofenceRefresh={() => geofence.refresh()}
          onBreakStart={handleBreakStart}
          onBreakEnd={handleBreakEnd}
          clockError={clockError}
          setClockError={setClockError}
        />
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
        {todayAssignment && isRestDay ? (
          <p className="muted-block">Rest day — no shift scheduled.</p>
        ) : todayShift ? (
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
                    <DtrTimingBadges record={r} />
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
