import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { hasPermission } from '../../lib/auth'
import { PageHeader } from '../../components/PageHeader'
import { PayslipDetailModal } from '../../components/PayslipDetailModal'
import type { Branch, PayrollRun, Payslip } from '../../types/hrms'

function money(value: string | number | undefined | null) {
  if (value == null || value === '') return '—'
  return `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function PayrollPage() {
  const { user } = useAuth()
  const canManage = hasPermission(user, 'payroll.manage')
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedRun, setSelectedRun] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    branch_id: '',
    period_start: '',
    period_end: '',
    pay_date: '',
  })
  const [detailId, setDetailId] = useState<string | null>(null)

  const selected = useMemo(() => runs.find((r) => r.id === selectedRun) ?? null, [runs, selectedRun])

  const load = async () => {
    const [r, b] = await Promise.all([
      api<PayrollRun[]>('/payroll/runs'),
      api<Branch[]>('/branches'),
    ])
    setRuns(r)
    setBranches(b)
    if (b[0] && !form.branch_id) setForm((f) => ({ ...f, branch_id: b[0].id }))
    if (r[0] && !selectedRun) setSelectedRun(r[0].id)
  }

  const loadPayslips = async (runId: string) => {
    if (!runId) return setPayslips([])
    setPayslips(await api<Payslip[]>(`/payroll/payslips?run_id=${runId}`))
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (selectedRun) loadPayslips(selectedRun)
  }, [selectedRun])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const run = await api<PayrollRun>('/payroll/runs', { method: 'POST', body: JSON.stringify(form) })
      setShowForm(false)
      setSelectedRun(run.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create payroll run')
    } finally {
      setBusy(false)
    }
  }

  const onGenerate = async () => {
    if (!selectedRun) return
    setError(null)
    setBusy(true)
    try {
      await api(`/payroll/${selectedRun}/generate-payslips`, { method: 'POST', body: '{}' })
      await Promise.all([loadPayslips(selectedRun), load()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate payslips')
    } finally {
      setBusy(false)
    }
  }

  const updateRunStatus = async (status: PayrollRun['status']) => {
    if (!selectedRun) return
    const label =
      status === 'approved' ? 'Approve this payroll run?' : status === 'paid' ? 'Mark as paid?' : 'Cancel this run?'
    if (!confirm(label)) return

    setError(null)
    setBusy(true)
    try {
      await api(`/payroll/${selectedRun}`, { method: 'PUT', body: JSON.stringify({ status }) })
      await Promise.all([loadPayslips(selectedRun), load()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update payroll run')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle="Create runs, generate payslips, approve and mark paid"
        actions={
          canManage ? (
            <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : 'New payroll run'}
            </button>
          ) : undefined
        }
      />

      {error && <p className="error-msg" style={{ marginBottom: '1rem' }}>{error}</p>}

      {showForm && canManage && (
        <form className="card" style={{ marginBottom: '1.5rem' }} onSubmit={onCreate}>
          <div className="form-group">
            <label>Branch</label>
            <select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })} required>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Period start</label>
              <input
                type="date"
                value={form.period_start}
                onChange={(e) => setForm({ ...form, period_start: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Period end</label>
              <input
                type="date"
                value={form.period_end}
                onChange={(e) => setForm({ ...form, period_end: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Pay date</label>
              <input
                type="date"
                value={form.pay_date}
                onChange={(e) => setForm({ ...form, pay_date: e.target.value })}
                required
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Create run
          </button>
        </form>
      )}

      <div className="form-group" style={{ maxWidth: 400, marginBottom: '1rem' }}>
        <label>Payroll run</label>
        <select value={selectedRun} onChange={(e) => setSelectedRun(e.target.value)}>
          <option value="">Select…</option>
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.branch_name} · {r.period_start} – {r.period_end} ({r.status})
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <div className="card payroll-run-panel" style={{ marginBottom: '1rem' }}>
          <div className="payroll-run-panel-head">
            <div>
              <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>
                {selected.branch_name} · {selected.period_start} – {selected.period_end}
              </h3>
              <p className="payroll-run-meta">
                Pay date {selected.pay_date}
                {selected.processed_at && (
                  <> · Processed {new Date(selected.processed_at.replace(' ', 'T')).toLocaleString()}</>
                )}
              </p>
            </div>
            <span className={`badge badge-${selected.status}`}>{selected.status}</span>
          </div>

          <div className="payroll-run-totals">
            <div>
              <span className="payroll-run-total-label">Total gross</span>
              <strong>{money(selected.total_gross)}</strong>
            </div>
            <div>
              <span className="payroll-run-total-label">Total net</span>
              <strong>{money(selected.total_net)}</strong>
            </div>
            <div>
              <span className="payroll-run-total-label">Payslips</span>
              <strong>{payslips.length}</strong>
            </div>
          </div>

          {canManage && (
            <div className="payroll-run-actions">
              {selected.status === 'draft' && (
                <button type="button" className="btn btn-primary" disabled={busy} onClick={onGenerate}>
                  Generate payslips from attendance
                </button>
              )}
              {selected.status === 'processing' && (
                <>
                  <button type="button" className="btn btn-primary" disabled={busy || payslips.length === 0} onClick={() => updateRunStatus('approved')}>
                    Approve run
                  </button>
                  <button type="button" className="btn btn-ghost" disabled={busy} onClick={onGenerate}>
                    Regenerate payslips
                  </button>
                </>
              )}
              {selected.status === 'approved' && (
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => updateRunStatus('paid')}>
                  Mark as paid
                </button>
              )}
              {['draft', 'processing', 'approved'].includes(selected.status) && (
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => updateRunStatus('cancelled')}>
                  Cancel run
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card table-wrap" style={{ marginBottom: '1.5rem' }}>
        <h3 className="section-title">All runs</h3>
        <table>
          <thead>
            <tr>
              <th>Branch</th>
              <th>Period</th>
              <th>Pay date</th>
              <th>Gross</th>
              <th>Net</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className={r.id === selectedRun ? 'row-selected' : undefined}>
                <td>{r.branch_name}</td>
                <td>
                  {r.period_start} – {r.period_end}
                </td>
                <td>{r.pay_date}</td>
                <td>{money(r.total_gross)}</td>
                <td>{money(r.total_net)}</td>
                <td>
                  <span className={`badge badge-${r.status}`}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedRun && (
        <div className="card table-wrap">
          <h3 className="section-title">Payslips</h3>
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Hours</th>
                <th>Gross</th>
                <th>SSS</th>
                <th>PhilHealth</th>
                <th>Pag-IBIG</th>
                <th>Net</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {payslips.map((p) => (
                <tr
                  key={p.id}
                  className="row-clickable"
                  onClick={() => setDetailId(p.id)}
                >
                  <td>
                    {p.first_name} {p.last_name}
                  </td>
                  <td>{p.regular_hours}</td>
                  <td>{money(p.gross_pay)}</td>
                  <td>{money(p.sss_amount)}</td>
                  <td>{money(p.philhealth_amount)}</td>
                  <td>{money(p.pagibig_amount)}</td>
                  <td>
                    <strong>{money(p.net_pay)}</strong>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDetailId(p.id)
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {payslips.length === 0 && (
            <p style={{ padding: '1rem', color: 'var(--muted)' }}>
              No payslips yet. Generate from attendance for this run.
            </p>
          )}
        </div>
      )}

      <PayslipDetailModal
        open={detailId != null}
        payslipId={detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  )
}
