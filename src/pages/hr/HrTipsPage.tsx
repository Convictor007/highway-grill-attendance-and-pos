import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { type LoadOptions, resolveLoadBehavior } from '../../lib/scroll'
import { useAuth } from '../../context/AuthContext'
import { useNotification } from '../../hooks/useNotification'
import { hasPermission } from '../../lib/auth'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmptyState } from '../../components/EmptyState'
import { DatePicker } from '../../components/DatePicker'
import type { Branch, TipsPool } from '../../types/hrms'

function money(value: string | number | undefined | null) {
  if (value == null || value === '') return '—'
  return `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function HrTipsPage() {
  const { user } = useAuth()
  const { success, error: notifyError, confirm } = useNotification()
  const canManage = hasPermission(user, 'payroll.manage')
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchFilter, setBranchFilter] = useState('')
  const [pools, setPools] = useState<TipsPool[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TipsPool | null>(null)
  const [form, setForm] = useState({
    branch_id: '',
    pool_date: '',
    total_tips: '',
    shift_type: 'all_day',
  })

  const loadPools = async (branchId?: string, options?: LoadOptions) => {
    const { showLoading, finish } = resolveLoadBehavior(options)
    if (showLoading) setLoading(true)
    try {
      const q = branchId ? `?branch_id=${encodeURIComponent(branchId)}` : ''
      setPools(await api<TipsPool[]>(`/tips/pools${q}`))
    } finally {
      setLoading(false)
      finish()
    }
  }

  useEffect(() => {
    api<Branch[]>('/branches')
      .then((b) => {
        setBranches(b)
        if (b[0] && !branchFilter) setBranchFilter(b[0].id)
        if (b[0] && !form.branch_id) setForm((f) => ({ ...f, branch_id: b[0].id }))
      })
      .catch(() => setBranches([]))
  }, [])

  useEffect(() => {
    if (branchFilter) loadPools(branchFilter)
  }, [branchFilter])

  useEffect(() => {
    if (!detailId) {
      setDetail(null)
      return
    }
    api<TipsPool>(`/tips/pools/${detailId}`)
      .then(setDetail)
      .catch(() => setDetail(null))
  }, [detailId])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api('/tips/pools', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          total_tips: Number(form.total_tips),
        }),
      })
      success('Tips pool created')
      setShowForm(false)
      setForm((f) => ({ ...f, pool_date: '', total_tips: '' }))
      await loadPools(branchFilter, { silent: true })
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not create tips pool')
    }
  }

  const distributeEqual = async (poolId: string) => {
    if (!(await confirm('Split this pool equally among all tipped positions in the branch?'))) return
    setBusyId(poolId)
    try {
      await api(`/tips/pools/${poolId}`, {
        method: 'POST',
        body: JSON.stringify({ equal: true }),
      })
      success('Tips distributed')
      await loadPools(branchFilter, { silent: true })
      if (detailId === poolId) {
        const d = await api<TipsPool>(`/tips/pools/${poolId}`)
        setDetail(d)
      }
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not distribute tips')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Tips pool"
        subtitle="Record daily tips and distribute to tipped staff for payroll"
        actions={
          canManage ? (
            <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : 'New pool'}
            </button>
          ) : undefined
        }
      />

      <div className="form-row" style={{ marginBottom: '1rem', maxWidth: 320 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Branch</label>
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {canManage && showForm && (
        <form className="card" style={{ marginBottom: '1.5rem' }} onSubmit={onCreate}>
          <h3 className="section-title">Create tips pool</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Branch</label>
              <select
                value={form.branch_id}
                onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
                required
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <DatePicker
              label="Pool date"
              value={form.pool_date}
              onChange={(v) => setForm({ ...form, pool_date: v })}
              required
            />
            <div className="form-group">
              <label>Total tips (₱)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.total_tips}
                onChange={(e) => setForm({ ...form, total_tips: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Shift</label>
              <select
                value={form.shift_type}
                onChange={(e) => setForm({ ...form, shift_type: e.target.value })}
              >
                <option value="all_day">All day</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary">
            Save pool
          </button>
        </form>
      )}

      <div className="card table-wrap">
        {loading ? (
          <LoadingBlock />
        ) : pools.length === 0 ? (
          <EmptyState
            title="No tips pools"
            description="Create a pool when you collect tips for a shift or day."
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Branch</th>
                <th>Shift</th>
                <th>Total</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pools.map((p) => (
                <tr key={p.id}>
                  <td>{p.pool_date}</td>
                  <td>{p.branch_name ?? '—'}</td>
                  <td>{p.shift_type}</td>
                  <td>{money(p.total_tips)}</td>
                  <td>
                    <span className={`badge badge-${p.status === 'distributed' ? 'paid' : 'draft'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td>
                    <div className="quick-actions" style={{ margin: 0 }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetailId(p.id)}>
                        View
                      </button>
                      {canManage && p.status === 'pending' && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busyId === p.id}
                          onClick={() => distributeEqual(p.id)}
                        >
                          Split equally
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detail && (
        <div className="card table-wrap" style={{ marginTop: '1.5rem' }}>
          <div className="list-toolbar">
            <h3 className="section-title" style={{ margin: 0 }}>
              {detail.pool_date} · {detail.branch_name} — {money(detail.total_tips)}
            </h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetailId(null)}>
              Close
            </button>
          </div>
          {(detail.distributions ?? []).length === 0 ? (
            <p className="muted-block" style={{ padding: '1rem 0' }}>
              Not distributed yet.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>%</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(detail.distributions ?? []).map((d) => (
                  <tr key={d.id}>
                    <td>
                      {d.first_name} {d.last_name}
                      {d.emp_number && (
                        <>
                          <br />
                          <span className="muted-inline">{d.emp_number}</span>
                        </>
                      )}
                    </td>
                    <td>{Number(d.percentage).toFixed(2)}%</td>
                    <td>{money(d.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
