import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { preserveScroll } from '../../lib/scroll'
import { useNotification } from '../../hooks/useNotification'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState } from '../../components/EmptyState'
import { LoadingBlock } from '../../components/LoadingBlock'
import { Modal } from '../../components/Modal'
import type { AttendanceCorrectionRequest } from '../../types/hrms'

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all'

const TYPE_LABEL: Record<string, string> = {
  missing_in: 'Forgot time-in',
  missing_out: 'Forgot time-out',
  missing_both: 'Forgot in & out',
  wrong_time: 'Wrong time',
}

function fmt(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function HrAttendanceCorrectionsPage() {
  const { success, error: notifyError } = useNotification()
  const [rows, setRows] = useState<AttendanceCorrectionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('pending')
  const [decision, setDecision] = useState<{ row: AttendanceCorrectionRequest; action: 'approve' | 'reject' } | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const q = filter === 'all' ? '' : `?status=${filter}`
      setRows(await api<AttendanceCorrectionRequest[]>(`/attendance/corrections${q}`))
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not load requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const submitDecision = async () => {
    if (!decision) return
    setBusy(true)
    try {
      await api(`/attendance/corrections/${decision.row.id}/${decision.action}`, {
        method: 'POST',
        body: JSON.stringify({ note: note.trim() || null }),
      })
      success(decision.action === 'approve' ? 'Correction applied' : 'Request declined')
      setDecision(null)
      setNote('')
      await preserveScroll(load)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not update request')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Attendance corrections" subtitle="Review and apply employee time-in/out fixes" />

      <div className="tabs tabs--sub" style={{ marginBottom: '1rem' }}>
        {(['pending', 'approved', 'rejected', 'all'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            className={`tab ${filter === s ? 'active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="card table-wrap">
        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState title="No requests" description="Correction requests from employees appear here." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Current</th>
                <th>Requested</th>
                <th>Reason</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.first_name} {r.last_name}
                    {r.emp_number ? <span className="muted-inline"> · {r.emp_number}</span> : null}
                  </td>
                  <td>{TYPE_LABEL[r.request_type] ?? r.request_type}</td>
                  <td>
                    {r.attendance_id ? (
                      <>
                        <div>in: {fmt(r.current_clock_in)}</div>
                        <div>out: {fmt(r.current_clock_out)}</div>
                      </>
                    ) : (
                      <span className="muted-inline">No record</span>
                    )}
                  </td>
                  <td>
                    <div>in: {fmt(r.requested_clock_in)}</div>
                    <div>out: {fmt(r.requested_clock_out)}</div>
                  </td>
                  <td style={{ maxWidth: 220, whiteSpace: 'normal' }}>{r.reason}</td>
                  <td>
                    <span className={`badge badge-${r.status}`}>{r.status}</span>
                  </td>
                  <td>
                    {r.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setNote('')
                            setDecision({ row: r, action: 'approve' })
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ marginLeft: 4 }}
                          onClick={() => {
                            setNote('')
                            setDecision({ row: r, action: 'reject' })
                          }}
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className="muted-inline">{r.review_note || '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={decision != null}
        title={decision?.action === 'approve' ? 'Approve correction' : 'Decline correction'}
        onClose={() => setDecision(null)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDecision(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={submitDecision}>
              {busy ? 'Saving…' : decision?.action === 'approve' ? 'Approve & apply' : 'Decline'}
            </button>
          </>
        }
      >
        {decision && (
          <div className="stack" style={{ gap: '0.75rem' }}>
            <p style={{ margin: 0 }}>
              {decision.action === 'approve'
                ? 'The attendance record will be created or updated and hours recomputed.'
                : 'The employee will be notified that this request was declined.'}
            </p>
            <div className="form-group">
              <label>Note {decision.action === 'approve' ? '(optional)' : ''}</label>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
