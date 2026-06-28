import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { type LoadOptions, resolveLoadBehavior } from '../../lib/scroll'
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
import { DtrTimingBadges, dtrTimingFlags } from '../../lib/dtrTiming'
import { ClockGeofenceBanner } from '../../components/ClockGeofenceBanner'
import { ClockHelpButton } from '../../components/ClockHelpButton'
import { useClockGeofence } from '../../hooks/useClockGeofence'
import { useVicinityMonitor } from '../../hooks/useVicinityMonitor'
import type { AttendanceRecord } from '../../types/hrms'
import { resolveClockOpenState } from '../../lib/clockState'
import { DtrExportForm } from '../../components/DtrExportForm'

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

function workDateFromClockIn(clockIn: string) {
  return clockIn.slice(0, 10)
}

export function DtrPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [clockError, setClockError] = useState<string | null>(null)
  const canClock = Boolean(user?.employee_id)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [summary, setSummary] = useState<HoursSummary | null>(null)
  const [open, setOpen] = useState(false)
  const [onBreak, setOnBreak] = useState(false)
  const [geofenceRequired, setGeofenceRequired] = useState(false)
  const [mobileClock, setMobileClock] = useState(false)
  const [positionLabel, setPositionLabel] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<'in' | 'out' | null>(null)
  const [shiftCtx, setShiftCtx] = useState<ShiftClockContext | null>(null)
  const geofence = useClockGeofence(geofenceRequired, { sessionActive: open && canClock })
  const showEndShift = open && !!shiftCtx?.show_end_shift

  const load = async (options?: LoadOptions) => {
    const { showLoading, finish } = resolveLoadBehavior(options)
    if (showLoading) setLoading(true)
    try {
      const to = new Date().toISOString().slice(0, 10)
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - 13)
      const from = fromDate.toISOString().slice(0, 10)
      const [status, weekSum, history] = await Promise.all([
        api<{
          open: boolean
          on_break?: boolean
          geofence_required?: boolean
          mobile_clock?: boolean
          position_label?: string | null
          shift?: ShiftClockContext | null
        }>('/attendance/status').catch(() => ({
          open: false,
          on_break: false,
          geofence_required: false,
          mobile_clock: false,
          position_label: null,
          shift: null,
        })),
        api<HoursSummary>('/attendance/summary'),
        api<AttendanceRecord[]>(`/attendance/history?from=${from}&to=${to}`),
      ])
      const clock = resolveClockOpenState(status, history)
      setOpen(clock.open)
      setOnBreak(clock.onBreak)
      if (clock.open) setClockError(null)
      setGeofenceRequired(!!status.geofence_required)
      setMobileClock(!!status.mobile_clock)
      setPositionLabel(status.position_label ?? null)
      setShiftCtx(status.shift ?? null)
      setSummary(weekSum)
      setRecords(history)
    } finally {
      setLoading(false)
      finish()
    }
  }

  useEffect(() => {
    load()
  }, [])

  const vicinity = useVicinityMonitor({
    enabled: open && canClock,
    geofenceRequired,
    onAutoClockOut: () => {
      load({ silent: true })
    },
    onLocationPing: (coords) => {
      void geofence.updateFromCoords(coords)
    },
  })

  const handleClockIn = async () => {
    if (!canClock) return
    setBusy(true)
    setPending('in')
    setClockError(null)
    try {
      await doClockIn(geofenceRequired)
      await geofence.refresh()
      await load({ silent: true })
    } catch (err) {
      const msg = clockErrorMessage(err)
      if (/already clocked/i.test(msg)) {
        await load({ silent: true })
      } else {
        setClockError(msg)
      }
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  const handleClockOut = async () => {
    if (!canClock) return
    setBusy(true)
    setPending('out')
    setClockError(null)
    try {
      await doClockOut()
      await load({ silent: true })
    } catch (err) {
      setClockError(clockErrorMessage(err))
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  const handleBreakStart = async () => {
    if (!canClock || !open) return
    setBusy(true)
    setClockError(null)
    try {
      await api('/attendance/break-start', { method: 'POST', body: '{}' })
      await load({ silent: true })
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
      await load({ silent: true })
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
        <div className="dtr-summary-week">
          <span className="dtr-summary-label">This week</span>
          <strong className="dtr-summary-value">
            {summary ? `${summary.total_hours.toFixed(1)} hrs` : '—'}
          </strong>
          <ClockHelpButton />
        </div>
        <div className="clock-actions clock-actions-inline">
          {!open ? (
            <button
              type="button"
              className="btn btn-clock-in btn-sm"
              disabled={busy || !canClock || !geofence.canClockIn || geofence.loading}
              onClick={handleClockIn}
            >
              {pending === 'in' ? 'Clocking in…' : 'Clock in'}
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
                  {pending === 'out' ? 'Ending shift…' : 'End shift'}
                </button>
              )}
              <button
                type="button"
                className="btn btn-clock-out btn-sm"
                disabled={busy || onBreak || !canClock}
                onClick={handleClockOut}
              >
                {pending === 'out' ? 'Clocking out…' : 'Clock out'}
              </button>
            </>
          )}
        </div>
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
        {clockError && <p className="error-msg" style={{ marginTop: '0.5rem' }}>{clockError}</p>}
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 className="card-section-title" style={{ marginTop: 0 }}>Export</h3>
        <DtrExportForm selfMode compact />
      </div>

      <div className="card table-wrap">
        {loading ? (
          <LoadingBlock />
        ) : records.length === 0 ? (
          <EmptyState title="No records" description="Your clock in/out history will appear here." />
        ) : (
          <table className="dtr-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time in</th>
                <th>Time out</th>
                <th>Timing</th>
                <th>Hours</th>
                <th>OT</th>
                <th>Location (in)</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDateLabel(workDateFromClockIn(r.clock_in))}</td>
                    <td>{formatTime(r.clock_in)}</td>
                    <td>
                      {formatTime(r.clock_out)}
                      {r.clock_out_type && r.clock_out_type !== 'manual' && (
                        <span className="badge badge-processing" style={{ marginLeft: '0.35rem' }}>
                          {r.clock_out_type.replace(/_/g, ' ')}
                        </span>
                      )}
                    </td>
                    <td>
                      <DtrTimingBadges record={r} />
                      {!dtrTimingFlags(r).hasAny && '—'}
                    </td>
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
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
