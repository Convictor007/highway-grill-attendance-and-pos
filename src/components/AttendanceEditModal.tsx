import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Modal } from './Modal'
import type { AttendanceRecord } from '../types/hrms'

type Props = {
  open: boolean
  record: AttendanceRecord | null
  onClose: () => void
  onSaved: () => void
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toSql(local: string): string | null {
  if (!local) return null
  return local.replace('T', ' ') + (local.length === 16 ? ':00' : '')
}

export function AttendanceEditModal({ open, record, onClose, onSaved }: Props) {
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [actualHours, setActualHours] = useState('')
  const [regularHours, setRegularHours] = useState('')
  const [overtimeHours, setOvertimeHours] = useState('')
  const [method, setMethod] = useState('manual')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !record) return
    setClockIn(toLocalInput(record.clock_in))
    setClockOut(toLocalInput(record.clock_out))
    setActualHours(record.actual_hours != null ? String(record.actual_hours) : '')
    setRegularHours(record.regular_hours != null ? String(record.regular_hours) : '')
    setOvertimeHours(record.overtime_hours != null ? String(record.overtime_hours) : '')
    setMethod('manual')
    setError(null)
  }, [open, record])

  const save = async () => {
    if (!record) return
    setError(null)
    if (!clockIn) {
      setError('Clock in is required')
      return
    }

    setSaving(true)
    try {
      await api(`/attendance/${record.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          clock_in: toSql(clockIn),
          clock_out: clockOut ? toSql(clockOut) : null,
          actual_hours: actualHours !== '' ? Number(actualHours) : undefined,
          regular_hours: regularHours !== '' ? Number(regularHours) : undefined,
          overtime_hours: overtimeHours !== '' ? Number(overtimeHours) : undefined,
          method,
        }),
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save attendance')
    } finally {
      setSaving(false)
    }
  }

  if (!open || !record) return null

  const label = [record.first_name, record.last_name].filter(Boolean).join(' ') || 'Employee'

  return (
    <Modal
      open={open}
      title={`Correct attendance — ${label}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save correction'}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: '0.75rem' }}>
        <label className="geofence-field">
          <span>Clock in</span>
          <input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} required />
        </label>
        <label className="geofence-field">
          <span>Clock out</span>
          <input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
        </label>
        <label className="geofence-field">
          <span>Total hours (optional)</span>
          <input
            type="number"
            step={0.25}
            value={actualHours}
            onChange={(e) => setActualHours(e.target.value)}
          />
        </label>
        <label className="geofence-field">
          <span>Regular hours</span>
          <input
            type="number"
            step={0.25}
            value={regularHours}
            onChange={(e) => setRegularHours(e.target.value)}
          />
        </label>
        <label className="geofence-field">
          <span>Overtime hours</span>
          <input
            type="number"
            step={0.25}
            value={overtimeHours}
            onChange={(e) => setOvertimeHours(e.target.value)}
          />
        </label>
        {record.clock_out_type && record.clock_out_type !== 'manual' && (
          <p className="muted-block" style={{ margin: 0 }}>
            Clock-out: {record.clock_out_type.replace(/_/g, ' ')}
          </p>
        )}
        <label className="geofence-field">
          <span>Method</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="manual">Manual correction</option>
            <option value="app">App</option>
            <option value="pin">PIN</option>
            <option value="biometric">Biometric</option>
          </select>
        </label>
      </div>
      {error && <p className="geofence-error">{error}</p>}
    </Modal>
  )
}
