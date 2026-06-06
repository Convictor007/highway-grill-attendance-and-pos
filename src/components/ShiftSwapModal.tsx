import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Modal } from './Modal'
import type { Employee, RosterGrid, RosterGridCell } from '../types/hrms'

type Props = {
  open: boolean
  cell: (RosterGridCell & { date: string }) | null
  coworkers: Employee[]
  onClose: () => void
  onSubmitted: () => void
}

export function ShiftSwapModal({ open, cell, coworkers, onClose, onSubmitted }: Props) {
  const [targetEmployeeId, setTargetEmployeeId] = useState('')
  const [message, setMessage] = useState('')
  const [mutual, setMutual] = useState(false)
  const [targetShifts, setTargetShifts] = useState<{ id: string; shift_date: string; start_time: string; end_time: string }[]>([])
  const [targetAssignmentId, setTargetAssignmentId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !cell) return
    setTargetEmployeeId('')
    setMessage('')
    setMutual(false)
    setTargetAssignmentId('')
    setTargetShifts([])
    setError(null)
  }, [open, cell])

  const loadTargetShifts = async (employeeId: string, weekStart: string) => {
    try {
      const roster = await api<RosterGrid>(
        `/shifts/roster?week_start=${encodeURIComponent(weekStart)}`
      )
      const row = roster.rows?.find((r) => r.employee_id === employeeId)
      if (!row) {
        setTargetShifts([])
        return
      }
      setTargetShifts(
        row.cells
          .filter((c) => !c.off && c.assignment_id)
          .map((c) => ({
            id: c.assignment_id!,
            shift_date: c.date,
            start_time: c.start_time ?? '',
            end_time: c.end_time ?? '',
          }))
      )
    } catch {
      setTargetShifts([])
    }
  }

  useEffect(() => {
    if (!open || !mutual || !targetEmployeeId || !cell) return
    const ws = sundayOf(cell.date)
    loadTargetShifts(targetEmployeeId, ws)
  }, [open, mutual, targetEmployeeId, cell])

  const submit = async () => {
    if (!cell?.assignment_id || !targetEmployeeId) {
      setError('Select a coworker')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api('/shifts/swaps', {
        method: 'POST',
        body: JSON.stringify({
          requester_assignment_id: cell.assignment_id,
          target_employee_id: targetEmployeeId,
          target_assignment_id: mutual && targetAssignmentId ? targetAssignmentId : undefined,
          message: message.trim() || undefined,
        }),
      })
      onSubmitted()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send swap request')
    } finally {
      setBusy(false)
    }
  }

  if (!cell) return null

  return (
    <Modal
      open={open}
      title="Request shift swap"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Sending…' : 'Send request'}
          </button>
        </>
      }
    >
      <p className="muted-block">
        Your shift: <strong>{cell.date}</strong> · {cell.label}
      </p>
      <div className="form-group">
        <label>Swap with</label>
        <select value={targetEmployeeId} onChange={(e) => setTargetEmployeeId(e.target.value)} required>
          <option value="">Select coworker…</option>
          {coworkers.map((e) => (
            <option key={e.id} value={e.id}>
              {e.first_name} {e.last_name}
            </option>
          ))}
        </select>
      </div>
      <label className="schedule-swap-check">
        <input type="checkbox" checked={mutual} onChange={(e) => setMutual(e.target.checked)} />
        Exchange shifts (they give me one of their shifts too)
      </label>
      {mutual && targetShifts.length > 0 && (
        <div className="form-group">
          <label>Their shift to swap</label>
          <select value={targetAssignmentId} onChange={(e) => setTargetAssignmentId(e.target.value)}>
            <option value="">Select their shift…</option>
            {targetShifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.shift_date} · {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}
              </option>
            ))}
          </select>
        </div>
      )}
      {mutual && targetEmployeeId && targetShifts.length === 0 && (
        <p className="muted-block">No upcoming shifts found for this coworker this week.</p>
      )}
      <div className="form-group">
        <label>Message (optional)</label>
        <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      {error && <p className="error-msg">{error}</p>}
    </Modal>
  )
}

function sundayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() - d.getDay())
  return d.toISOString().slice(0, 10)
}
