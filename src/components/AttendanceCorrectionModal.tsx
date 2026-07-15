import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { toLocalDateTimeInput, toSqlDateTime } from '../lib/datetime'
import { useNotification } from '../hooks/useNotification'
import { Modal } from './Modal'
import { DateTimePicker } from './DateTimePicker'
import type { AttendanceCorrectionType, AttendanceRecord } from '../types/hrms'

type Props = {
  open: boolean
  /** Optional existing record to correct (prefills the linked attendance + times). */
  record?: AttendanceRecord | null
  onClose: () => void
  onSaved: () => void
}

const TYPE_OPTIONS: { value: AttendanceCorrectionType; label: string }[] = [
  { value: 'missing_both', label: 'Forgot to clock in and out' },
  { value: 'missing_in', label: 'Forgot to clock in' },
  { value: 'missing_out', label: 'Forgot to clock out' },
  { value: 'wrong_time', label: 'Recorded time is wrong' },
]

export function AttendanceCorrectionModal({ open, record, onClose, onSaved }: Props) {
  const { success } = useNotification()
  const [requestType, setRequestType] = useState<AttendanceCorrectionType>('missing_both')
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (record) {
      setRequestType(record.clock_out ? 'wrong_time' : 'missing_out')
      setClockIn(toLocalDateTimeInput(record.clock_in))
      setClockOut(toLocalDateTimeInput(record.clock_out))
    } else {
      setRequestType('missing_both')
      setClockIn('')
      setClockOut('')
    }
    setReason('')
    setError(null)
  }, [open, record])

  const needsIn = requestType !== 'missing_out'
  const needsOut = requestType !== 'missing_in'

  const submit = async () => {
    setError(null)
    if (needsIn && !clockIn) {
      setError('Please provide the corrected time-in')
      return
    }
    if (needsOut && !clockOut) {
      setError('Please provide the corrected time-out')
      return
    }
    if (!reason.trim()) {
      setError('Please add a reason')
      return
    }

    setSaving(true)
    try {
      await api('/attendance/corrections', {
        method: 'POST',
        body: JSON.stringify({
          request_type: requestType,
          attendance_id: record?.id ?? null,
          requested_clock_in: needsIn && clockIn ? toSqlDateTime(clockIn) : null,
          requested_clock_out: needsOut && clockOut ? toSqlDateTime(clockOut) : null,
          reason: reason.trim(),
        }),
      })
      success('Correction request submitted for HR review')
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit request')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      title="Request attendance correction"
      onClose={onClose}
      size="wide"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={submit}>
            {saving ? 'Submitting…' : 'Submit request'}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: '1rem' }}>
        <p className="form-hint" style={{ margin: 0 }}>
          Use this when you forgot to clock in or out, had no internet, or the recorded time is wrong.
          HR will review and apply the correction. Allowed for the last 14 days.
        </p>

        <div className="form-group">
          <label>What happened?</label>
          <select
            value={requestType}
            onChange={(e) => setRequestType(e.target.value as AttendanceCorrectionType)}
            disabled={!!record}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          {needsIn && <DateTimePicker label="Correct time-in" value={clockIn} onChange={setClockIn} required />}
          {needsOut && <DateTimePicker label="Correct time-out" value={clockOut} onChange={setClockOut} required />}
        </div>

        <div className="form-group">
          <label>Reason</label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. No internet at the branch, phone died, forgot to tap clock out…"
          />
        </div>

        {error && <p className="error-msg" style={{ margin: 0 }}>{error}</p>}
      </div>
    </Modal>
  )
}
