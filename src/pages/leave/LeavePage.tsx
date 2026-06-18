import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { preserveScroll } from '../../lib/scroll'
import { useAuth } from '../../context/AuthContext'
import { useNotification } from '../../hooks/useNotification'
import { hasPermission } from '../../lib/auth'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState } from '../../components/EmptyState'
import { LeaveTypeModal, type LeaveTypeRecord } from '../../components/LeaveTypeModal'
import { DatePicker } from '../../components/DatePicker'
import type { LeaveBalance, LeaveRequest } from '../../types/hrms'

export function LeavePage() {
  const { user } = useAuth()
  const { success, error: notifyError, confirm } = useNotification()
  const canApply = hasPermission(user, 'leave.apply')
  const canApprove = hasPermission(user, 'leave.approve')
  const canManageTypes = hasPermission(user, 'leave.manage')
  const canViewBalances = hasPermission(user, 'leave.view')
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [types, setTypes] = useState<LeaveTypeRecord[]>([])
  const [typeModalOpen, setTypeModalOpen] = useState(false)
  const [editingType, setEditingType] = useState<LeaveTypeRecord | null>(null)
  const [form, setForm] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
  })

  const load = async () => {
    const reqs = await api<LeaveRequest[]>('/leave/requests')
    setRequests(reqs)
    const tps = await api<LeaveTypeRecord[]>('/leave/types')
    setTypes(tps)
    if (tps[0] && !form.leave_type_id) setForm((f) => ({ ...f, leave_type_id: tps[0].id }))
    if (canViewBalances) {
      const year = new Date().getFullYear()
      const bal = await api<LeaveBalance[]>(`/leave/balances?year=${year}`)
      const ownOnly = !canApprove && user?.employee_id
      setBalances(ownOnly ? bal.filter((b) => b.employee_id === user.employee_id) : bal)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onApply = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api('/leave/requests', { method: 'POST', body: JSON.stringify(form) })
      success('Leave request submitted')
      setForm({ leave_type_id: types[0]?.id ?? '', start_date: '', end_date: '', reason: '' })
      await preserveScroll(load)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not submit leave request')
    }
  }

  const cancel = async (id: string) => {
    if (!(await confirm('Cancel this leave request?'))) return
    try {
      await api(`/leave/${id}/cancel`, { method: 'PUT', body: '{}' })
      success('Leave request cancelled')
      await preserveScroll(load)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not cancel leave request')
    }
  }

  const review = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await api(`/leave/${id}/review`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      success(status === 'approved' ? 'Leave approved' : 'Leave rejected')
      await preserveScroll(load)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not update leave request')
    }
  }

  return (
    <div>
      <PageHeader
        title={canApprove ? 'Leave management' : 'Leaves'}
        subtitle={canApprove ? 'Approve requests and view team balances' : 'Apply for leave and track balances'}
        actions={
          canManageTypes ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setEditingType(null)
                setTypeModalOpen(true)
              }}
            >
              Add leave type
            </button>
          ) : undefined
        }
      />

      {canManageTypes && (
        <div className="card table-wrap" style={{ marginBottom: '1.5rem' }}>
          <h3 className="section-title">Leave types</h3>
          {types.length === 0 ? (
            <EmptyState title="No leave types" description="Add types such as Vacation, Sick, or Emergency leave." />
          ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Days / year</th>
                <th>Paid</th>
                <th>Approval</th>
                <th>Carry forward</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id}>
                  <td>
                    <span
                      className="leave-type-swatch"
                      style={{ backgroundColor: t.color_hex ?? '#378ADD' }}
                      aria-hidden
                    />
                    {t.name}
                  </td>
                  <td>{t.days_per_year}</td>
                  <td>{t.paid ? 'Yes' : 'No'}</td>
                  <td>{t.requires_approval ? 'Yes' : 'No'}</td>
                  <td>{t.carry_forward ? 'Yes' : 'No'}</td>
                  <td>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => {
                        setEditingType(t)
                        setTypeModalOpen(true)
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      )}

      {canManageTypes && (
        <LeaveTypeModal
          open={typeModalOpen}
          editing={editingType}
          onClose={() => {
            setTypeModalOpen(false)
            setEditingType(null)
          }}
          onSaved={() => preserveScroll(load)}
        />
      )}

      {canViewBalances && balances.length > 0 && (
        <div className="card table-wrap" style={{ marginBottom: '1.5rem' }}>
          <h3 className="section-title">Leave balances ({new Date().getFullYear()})</h3>
          <table>
            <thead>
              <tr>
                {canApprove && <th>Employee</th>}
                <th>Type</th>
                <th>Accrued</th>
                <th>Used</th>
                <th>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => {
                const rem = Number(b.accrued) - Number(b.used) - Number(b.pending)
                return (
                  <tr key={b.id}>
                    {canApprove && <td>{b.first_name} {b.last_name}</td>}
                    <td>{b.leave_type_name}</td>
                    <td>{b.accrued}</td>
                    <td>{b.used}</td>
                    <td>{rem.toFixed(1)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {canApply && (
        <form className="card" style={{ marginBottom: '1.5rem' }} onSubmit={onApply}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Apply for leave</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select value={form.leave_type_id} onChange={(e) => setForm({ ...form, leave_type_id: e.target.value })} required>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <DatePicker
              label="Start"
              value={form.start_date}
              onChange={(v) => setForm({ ...form, start_date: v })}
              required
            />
            <DatePicker
              label="End"
              value={form.end_date}
              onChange={(v) => setForm({ ...form, end_date: v })}
              min={form.start_date || undefined}
              required
            />
          </div>
          <div className="form-group">
            <label>Reason</label>
            <textarea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary">Submit</button>
        </form>
      )}

      <div className="card table-wrap">
        <h3 className="section-title">Requests</h3>
        {requests.length === 0 ? (
          <EmptyState title="No leave requests" />
        ) : (
        <table>
          <thead>
            <tr>
              {canApprove && <th>Employee</th>}
              <th>Type</th>
              <th>Dates</th>
              <th>Days</th>
              <th>Status</th>
              {(canApprove || canApply) && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                {canApprove && <td>{r.first_name} {r.last_name}</td>}
                <td>{r.leave_type_name}</td>
                <td>{r.start_date} – {r.end_date}</td>
                <td>{r.days_count}</td>
                <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                {(canApprove || canApply) && (
                  <td>
                    {canApprove && r.status === 'pending' && (
                      <>
                        <button type="button" className="btn btn-ghost" onClick={() => review(r.id, 'approved')}>Approve</button>
                        <button type="button" className="btn btn-ghost" style={{ marginLeft: 4 }} onClick={() => review(r.id, 'rejected')}>Reject</button>
                      </>
                    )}
                    {canApply && !canApprove && r.status === 'pending' && (
                      <button type="button" className="btn btn-ghost" onClick={() => cancel(r.id)}>Cancel</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  )
}
