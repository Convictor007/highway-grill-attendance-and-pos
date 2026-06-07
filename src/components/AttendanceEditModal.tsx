import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { toLocalDateTimeInput, toSqlDateTime } from '../lib/datetime'
import { Modal } from './Modal'
import { DateTimePicker } from './DateTimePicker'
import type { AttendanceRecord } from '../types/hrms'

type Props = {
  open: boolean
  record: AttendanceRecord | null
  onClose: () => void
  onSaved: () => void
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
    setClockIn(toLocalDateTimeInput(record.clock_in))
    setClockOut(toLocalDateTimeInput(record.clock_out))
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
          clock_in: toSqlDateTime(clockIn),
          clock_out: clockOut ? toSqlDateTime(clockOut) : null,
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
      size="wide"
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
      <div className="stack" style={{ gap: '1rem' }}>
        <div className="form-row">
          <DateTimePicker label="Clock in" value={clockIn} onChange={setClockIn} required />
          <DateTimePicker label="Clock out" value={clockOut} onChange={setClockOut} />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Total hours</label>
            <input
              type="number"
              step={0.25}
              value={actualHours}
              onChange={(e) => setActualHours(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Regular hours</label>
            <input
              type="number"
              step={0.25}
              value={regularHours}
              onChange={(e) => setRegularHours(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Overtime hours</label>
            <input
              type="number"
              step={0.25}
              value={overtimeHours}
              onChange={(e) => setOvertimeHours(e.target.value)}
            />
          </div>
        </div>

        {record.clock_out_type && record.clock_out_type !== 'manual' && (
          <p className="muted-block" style={{ margin: 0 }}>
            Clock-out: {record.clock_out_type.replace(/_/g, ' ')}
          </p>
        )}

        <div className="form-group">
          <label>Method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="manual">Manual correction</option>
            <option value="app">App</option>
            <option value="pin">PIN</option>
          </select>
        </div>
      </div>
      {error && <p className="error-msg" style={{ marginTop: '0.75rem' }}>{error}</p>}
    </Modal>
  )
}
