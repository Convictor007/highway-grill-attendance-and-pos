import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { clockIn as doClockIn, clockOut as doClockOut, clockErrorMessage } from '../../lib/clock'
import { useAuth } from '../../context/AuthContext'
import { hasPermission } from '../../lib/auth'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmptyState } from '../../components/EmptyState'
import { ClockGeofenceBanner } from '../../components/ClockGeofenceBanner'
import { AttendanceEditModal } from '../../components/AttendanceEditModal'
import { DatePicker } from '../../components/DatePicker'
import { useClockGeofence } from '../../hooks/useClockGeofence'
import { useVicinityMonitor } from '../../hooks/useVicinityMonitor'
import { todayLocalIsoDate } from '../../lib/datetime'
import type { AttendanceRecord } from '../../types/hrms'

export function AttendancePage() {
  const { user } = useAuth()
  const canSelf = hasPermission(user, 'attendance.self')
  const canView = hasPermission(user, 'attendance.view')
  const canManage = hasPermission(user, 'attendance.manage')
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [open, setOpen] = useState(false)
  const [onBreak, setOnBreak] = useState(false)
  const [weekHours, setWeekHours] = useState<{ total_hours: number; shift_count: number } | null>(null)
  const [date, setDate] = useState(todayLocalIsoDate)
  const [loading, setLoading] = useState(true)
  const [clockError, setClockError] = useState<string | null>(null)
  const [geofenceRequired, setGeofenceRequired] = useState(false)
  const geofence = useClockGeofence(geofenceRequired && canSelf, { sessionActive: open && canSelf })
  const vicinity = useVicinityMonitor({
    enabled: open && canSelf && Boolean(user?.employee_id),
    geofenceRequired,
    onAutoClockOut: () => {
      load()
    },
    onLocationPing: (coords) => {
      void geofence.updateFromCoords(coords)
    },
  })
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      if (canView || canSelf) {
        const data = await api<AttendanceRecord[]>(`/attendance?date=${date}`)
        setRecords(data)
      }
      if (canSelf) {
        const st = await api<{ open: boolean; on_break?: boolean; geofence_required?: boolean }>('/attendance/status')
        setOpen(st.open)
        setOnBreak(!!st.on_break)
        setGeofenceRequired(!!st.geofence_required)
        api<{ total_hours: number; shift_count: number }>('/attendance/summary')
          .then(setWeekHours)
          .catch(() => setWeekHours(null))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [date])

  const clockIn = async () => {
    setClockError(null)
    try {
      await doClockIn(geofenceRequired)
      await geofence.refresh()
      load()
    } catch (err) {
      setClockError(clockErrorMessage(err))
    }
  }

  const clockOut = async () => {
    setClockError(null)
    try {
      await doClockOut()
      load()
    } catch (err) {
      setClockError(clockErrorMessage(err))
    }
  }

  const breakStart = async () => {
    await api('/attendance/break-start', { method: 'POST', body: '{}' })
    load()
  }

  const breakEnd = async () => {
    await api('/attendance/break-end', { method: 'POST', body: '{}' })
    load()
  }

  const title = canView ? 'Attendance register' : 'My attendance'

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={
          canView
            ? 'Daily clock records. Assign planned hours under Shifts → Roster.'
            : 'Clock in and view your hours'
        }
      />

      {canSelf && !user?.employee_id && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'var(--danger)' }}>
          <p className="error-msg" style={{ margin: 0 }}>
            Your user account is not linked to an employee. HR must assign an employee on the Users page.
          </p>
        </div>
      )}

      {canSelf && user?.employee_id && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 className="section-title">Time clock</h3>
          <p style={{ marginBottom: '0.75rem' }}>
            {onBreak ? 'You are on break.' : open ? 'You are clocked in.' : 'You are clocked out.'}
          </p>
          <ClockGeofenceBanner
            required={geofenceRequired}
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
          {clockError && <p className="error-msg">{clockError}</p>}
          {weekHours && (
            <p style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>
              This week: {weekHours.total_hours.toFixed(1)} hours ({weekHours.shift_count} shifts)
            </p>
          )}
          <div className="quick-actions">
            {!open && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!geofence.canClockIn || geofence.loading}
                onClick={clockIn}
              >
                Clock in
              </button>
            )}
            {open && !onBreak && (
              <>
                <button type="button" className="btn btn-ghost" onClick={breakStart}>
                  Start break
                </button>
                <button type="button" className="btn btn-primary" onClick={clockOut}>
                  Clock out
                </button>
              </>
            )}
            {open && onBreak && (
              <button type="button" className="btn btn-primary" onClick={breakEnd}>
                End break
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 240, marginBottom: '1rem' }}>
        <DatePicker label="Date" value={date} onChange={setDate} />
      </div>

      <div className="card table-wrap">
        {loading ? (
          <LoadingBlock />
        ) : records.length === 0 ? (
          <EmptyState title="No records for this date" description="Try another day or clock in to start a session." />
        ) : (
          <table>
            <thead>
              <tr>
                {canView && <th>Employee</th>}
                <th>Clock in</th>
                <th>Clock out</th>
                <th>Hours</th>
                <th>OT</th>
                <th>Clock-out</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  {canView && (
                    <td>
                      {r.first_name} {r.last_name}
                    </td>
                  )}
                  <td>{new Date(r.clock_in).toLocaleString()}</td>
                  <td>{r.clock_out ? new Date(r.clock_out).toLocaleString() : '—'}</td>
                  <td>{r.actual_hours ?? '—'}</td>
                  <td>{r.overtime_hours && Number(r.overtime_hours) > 0 ? r.overtime_hours : '—'}</td>
                  <td>
                    {r.clock_out_type && r.clock_out_type !== 'manual' ? (
                      <span className="badge badge-processing">{r.clock_out_type.replace(/_/g, ' ')}</span>
                    ) : (
                      'manual'
                    )}
                  </td>
                  {canManage && (
                    <td>
                      <button type="button" className="text-link" onClick={() => setEditingRecord(r)}>
                        Correct
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canManage && (
        <AttendanceEditModal
          open={editingRecord !== null}
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
