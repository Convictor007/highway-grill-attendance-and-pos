import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { clockIn as doClockIn, clockOut as doClockOut, clockErrorMessage } from '../../lib/clock'
import { useAuth } from '../../context/AuthContext'
import { hasPermission } from '../../lib/auth'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmptyState } from '../../components/EmptyState'
import { ClockGeofenceBanner } from '../../components/ClockGeofenceBanner'
import { AttendanceEditModal } from '../../components/AttendanceEditModal'
import { useClockGeofence } from '../../hooks/useClockGeofence'
import type { AttendanceRecord, Employee } from '../../types/hrms'

interface FieldVisit {
  id: string
  first_name?: string
  last_name?: string
  site_name: string | null
  address: string | null
  checked_in_at: string
  notes: string | null
  attendance_id?: string | null
}

export function AttendancePage() {
  const { user } = useAuth()
  const canSelf = hasPermission(user, 'attendance.self')
  const canView = hasPermission(user, 'attendance.view')
  const canManage = hasPermission(user, 'attendance.manage')
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [fieldVisits, setFieldVisits] = useState<FieldVisit[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [open, setOpen] = useState(false)
  const [onBreak, setOnBreak] = useState(false)
  const [weekHours, setWeekHours] = useState<{ total_hours: number; shift_count: number } | null>(null)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [showManual, setShowManual] = useState(false)
  const [clockError, setClockError] = useState<string | null>(null)
  const [geofenceRequired, setGeofenceRequired] = useState(false)
  const geofence = useClockGeofence(geofenceRequired && canSelf)
  const [manual, setManual] = useState({
    employee_id: '',
    clock_in: '',
    clock_out: '',
    actual_hours: '',
  })
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      if (canView || canSelf) {
        const data = await api<AttendanceRecord[]>(`/attendance?date=${date}`)
        setRecords(data)
      }
      if (canView) {
        const visits = await api<FieldVisit[]>(`/field-work/checkins?date=${date}&limit=100`)
        setFieldVisits(visits)
      } else {
        setFieldVisits([])
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
      if (canManage) {
        const emps = await api<Employee[]>('/employees?status=active')
        setEmployees(emps)
        if (emps[0] && !manual.employee_id) {
          setManual((m) => ({ ...m, employee_id: emps[0].id }))
        }
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
      await doClockIn()
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

  const onManual = async (e: FormEvent) => {
    e.preventDefault()
    const toSql = (v: string) => (v ? v.replace('T', ' ') + (v.length === 16 ? ':00' : '') : null)
    await api('/attendance/manual', {
      method: 'POST',
      body: JSON.stringify({
        employee_id: manual.employee_id,
        clock_in: toSql(manual.clock_in),
        clock_out: manual.clock_out ? toSql(manual.clock_out) : null,
        actual_hours: manual.actual_hours ? Number(manual.actual_hours) : undefined,
        method: 'manual',
      }),
    })
    setShowManual(false)
    load()
  }

  const title = canView ? 'Attendance register' : 'My attendance'

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={canView ? 'Daily clock records for all staff' : 'Clock in and view your hours'}
        actions={
          canManage ? (
            <button type="button" className="btn btn-primary" onClick={() => setShowManual(!showManual)}>
              {showManual ? 'Cancel' : 'Manual entry'}
            </button>
          ) : undefined
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
            required={geofenceRequired && !open}
            loading={geofence.loading}
            inside={geofence.inside}
            siteName={geofence.siteName}
            locationDenied={geofence.locationDenied}
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

      {showManual && canManage && (
        <form className="card" style={{ marginBottom: '1.5rem' }} onSubmit={onManual}>
          <h3 className="section-title">Manual attendance entry</h3>
          <div className="form-group">
            <label>Employee</label>
            <select
              value={manual.employee_id}
              onChange={(e) => setManual({ ...manual, employee_id: e.target.value })}
              required
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.emp_number} — {e.first_name} {e.last_name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Clock in</label>
              <input
                type="datetime-local"
                value={manual.clock_in}
                onChange={(e) => setManual({ ...manual, clock_in: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Clock out</label>
              <input
                type="datetime-local"
                value={manual.clock_out}
                onChange={(e) => setManual({ ...manual, clock_out: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Hours (optional)</label>
              <input
                type="number"
                step="0.25"
                value={manual.actual_hours}
                onChange={(e) => setManual({ ...manual, actual_hours: e.target.value })}
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">Save entry</button>
        </form>
      )}

      <div className="form-group" style={{ maxWidth: 200, marginBottom: '1rem' }}>
        <label>Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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

      {canView && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 className="section-title">Field visits</h2>
          {loading ? (
            <LoadingBlock />
          ) : fieldVisits.length === 0 ? (
            <EmptyState
              title="No field visits"
              description="Off-site check-ins from the Field Work page appear here for this date."
            />
          ) : (
            <ul className="field-checkin-list">
              {fieldVisits.map((v) => (
                <li key={v.id} className="field-checkin-row">
                  <div>
                    <strong>
                      {v.first_name} {v.last_name}
                    </strong>
                    <span className="field-checkin-time">
                      {v.site_name ?? 'Work zone'} · {new Date(v.checked_in_at.replace(' ', 'T')).toLocaleString()}
                      {v.attendance_id ? ' · linked to attendance' : ''}
                    </span>
                    {v.address && <span className="field-checkin-notes">{v.address}</span>}
                    {v.notes && <span className="field-checkin-notes">{v.notes}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
