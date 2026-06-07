import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { hasPermission } from '../../lib/auth'
import { PageHeader } from '../../components/PageHeader'
import { PayslipDetailModal } from '../../components/PayslipDetailModal'
import { DatePicker } from '../../components/DatePicker'
import type {
  BenefitEnrollment,
  Branch,
  Employee,
  PayrollAdjustment,
  PayrollRun,
  Payslip,
  TipsPool,
} from '../../types/hrms'

function money(value: string | number | undefined | null) {
  if (value == null || value === '') return '—'
  return `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

type PayrollTab = 'runs' | 'adjustments' | 'tips' | 'benefits' | '13th'

export function PayrollPage() {
  const { user } = useAuth()
  const canManage = hasPermission(user, 'payroll.manage')
  const [tab, setTab] = useState<PayrollTab>('runs')
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [adjustments, setAdjustments] = useState<PayrollAdjustment[]>([])
  const [tipsPools, setTipsPools] = useState<TipsPool[]>([])
  const [benefits, setBenefits] = useState<BenefitEnrollment[]>([])
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
  const [adjForm, setAdjForm] = useState({
    employee_id: '',
    adj_type: 'allowance',
    amount: '',
    description: '',
    recurring: true,
  })
  const [tipsForm, setTipsForm] = useState({ branch_id: '', pool_date: '', total_tips: '', shift_type: 'all_day' })
  const [benefitForm, setBenefitForm] = useState({
    employee_id: '',
    benefit_name: '',
    benefit_code: 'allowance',
    amount: '',
    frequency: 'monthly',
  })
  const [thirteenthForm, setThirteenthForm] = useState({
    branch_id: '',
    period_start: '',
    period_end: '',
    pay_date: '',
  })

  const selected = useMemo(() => runs.find((r) => r.id === selectedRun) ?? null, [runs, selectedRun])

  const loadExtras = async () => {
    const [adj, pools, ben, emps] = await Promise.all([
      api<PayrollAdjustment[]>('/payroll/adjustments?recurring=1').catch(() => []),
      api<TipsPool[]>('/tips/pools').catch(() => []),
      api<BenefitEnrollment[]>('/benefits').catch(() => []),
      api<Employee[]>('/employees?status=active').catch(() => []),
    ])
    setAdjustments(adj)
    setTipsPools(pools)
    setBenefits(ben)
    setEmployees(emps)
  }

  const load = async () => {
    const [r, b] = await Promise.all([
      api<PayrollRun[]>('/payroll/runs'),
      api<Branch[]>('/branches'),
    ])
    setRuns(r)
    setBranches(b)
    if (b[0] && !form.branch_id) setForm((f) => ({ ...f, branch_id: b[0].id }))
    if (b[0] && !tipsForm.branch_id) setTipsForm((f) => ({ ...f, branch_id: b[0].id }))
    if (b[0] && !thirteenthForm.branch_id) setThirteenthForm((f) => ({ ...f, branch_id: b[0].id }))
    if (r[0] && !selectedRun) setSelectedRun(r[0].id)
    if (canManage) await loadExtras()
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
        subtitle="Runs, adjustments, tips pool, benefits, and 13th month"
        actions={
          canManage && tab === 'runs' ? (
            <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : 'New payroll run'}
            </button>
          ) : undefined
        }
      />

      {canManage && (
        <div className="tabs" style={{ marginBottom: '1rem' }}>
          {(['runs', 'adjustments', 'tips', 'benefits', '13th'] as PayrollTab[]).map((t) => (
            <button key={t} type="button" className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === '13th' ? '13th month' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      )}

      {error && <p className="error-msg" style={{ marginBottom: '1rem' }}>{error}</p>}

      {tab === 'runs' && showForm && canManage && (
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
            <DatePicker
              label="Period start"
              value={form.period_start}
              onChange={(v) => setForm({ ...form, period_start: v })}
              required
            />
            <DatePicker
              label="Period end"
              value={form.period_end}
              onChange={(v) => setForm({ ...form, period_end: v })}
              min={form.period_start || undefined}
              required
            />
            <DatePicker
              label="Pay date"
              value={form.pay_date}
              onChange={(v) => setForm({ ...form, pay_date: v })}
              min={form.period_end || form.period_start || undefined}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Create run
          </button>
        </form>
      )}

      {tab === 'runs' && (
      <div className="form-group" style={{ maxWidth: 400, marginBottom: '1rem' }}>
        <label>Payroll run</label>
        <select value={selectedRun} onChange={(e) => setSelectedRun(e.target.value)}>
          <option value="">Select…</option>
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.branch_name} · {r.period_start} – {r.period_end}
              {r.run_type === '13th_month' ? ' [13th]' : ''} ({r.status})
            </option>
          ))}
        </select>
      </div>
      )}

      {tab === 'runs' && selected && (
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
                  {selected.run_type === '13th_month'
                    ? 'Generate 13th month payslips'
                    : 'Generate payslips from attendance'}
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

      {tab === 'runs' && (
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
      )}

      {tab === 'runs' && selectedRun && (
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

      {tab === 'adjustments' && canManage && (
        <div className="stack">
          <form
            className="card"
            onSubmit={async (e) => {
              e.preventDefault()
              setError(null)
              try {
                await api('/payroll/adjustments', {
                  method: 'POST',
                  body: JSON.stringify({
                    employee_id: adjForm.employee_id,
                    adj_type: adjForm.adj_type,
                    amount: Number(adjForm.amount),
                    description: adjForm.description || undefined,
                    payroll_run_id: adjForm.recurring ? null : selectedRun || undefined,
                  }),
                })
                await loadExtras()
                setAdjForm({ employee_id: '', adj_type: 'allowance', amount: '', description: '', recurring: true })
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not save adjustment')
              }
            }}
          >
            <h3 className="section-title">Add adjustment / allowance</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Employee</label>
                <select
                  value={adjForm.employee_id}
                  onChange={(e) => setAdjForm({ ...adjForm, employee_id: e.target.value })}
                  required
                >
                  <option value="">Select…</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.first_name} {e.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Type</label>
                <select
                  value={adjForm.adj_type}
                  onChange={(e) => setAdjForm({ ...adjForm, adj_type: e.target.value })}
                >
                  <option value="allowance">Allowance</option>
                  <option value="bonus">Bonus</option>
                  <option value="meal">Meal</option>
                  <option value="transport">Transport</option>
                  <option value="advance">Advance (deduction)</option>
                  <option value="penalty">Penalty (deduction)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Amount (₱)</label>
                <input
                  type="number"
                  step="0.01"
                  value={adjForm.amount}
                  onChange={(e) => setAdjForm({ ...adjForm, amount: e.target.value })}
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">
              Save
            </button>
          </form>
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {adjustments.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.first_name} {a.last_name}
                    </td>
                    <td>{a.adj_type}</td>
                    <td>{money(a.amount)}</td>
                    <td>{a.description ?? '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="text-link text-link--danger"
                        onClick={async () => {
                          if (!confirm('Remove adjustment?')) return
                          await api(`/payroll/adjustments/${a.id}`, { method: 'DELETE' })
                          loadExtras()
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'tips' && canManage && (
        <div className="stack">
          <form
            className="card"
            onSubmit={async (e) => {
              e.preventDefault()
              setError(null)
              try {
                await api('/tips/pools', {
                  method: 'POST',
                  body: JSON.stringify({
                    ...tipsForm,
                    total_tips: Number(tipsForm.total_tips),
                  }),
                })
                await loadExtras()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not create tips pool')
              }
            }}
          >
            <h3 className="section-title">New tips pool</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Branch</label>
                <select
                  value={tipsForm.branch_id}
                  onChange={(e) => setTipsForm({ ...tipsForm, branch_id: e.target.value })}
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
                label="Date"
                value={tipsForm.pool_date}
                onChange={(v) => setTipsForm({ ...tipsForm, pool_date: v })}
                required
              />
              <div className="form-group">
                <label>Total tips (₱)</label>
                <input
                  type="number"
                  step="0.01"
                  value={tipsForm.total_tips}
                  onChange={(e) => setTipsForm({ ...tipsForm, total_tips: e.target.value })}
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">
              Create pool
            </button>
          </form>
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Branch</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tipsPools.map((p) => (
                  <tr key={p.id}>
                    <td>{p.pool_date}</td>
                    <td>{p.branch_name}</td>
                    <td>{money(p.total_tips)}</td>
                    <td>{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'benefits' && canManage && (
        <div className="stack">
          <form
            className="card"
            onSubmit={async (e) => {
              e.preventDefault()
              setError(null)
              try {
                await api('/benefits', {
                  method: 'POST',
                  body: JSON.stringify({
                    ...benefitForm,
                    amount: Number(benefitForm.amount),
                  }),
                })
                await loadExtras()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not enroll benefit')
              }
            }}
          >
            <h3 className="section-title">Enroll benefit</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Employee</label>
                <select
                  value={benefitForm.employee_id}
                  onChange={(e) => setBenefitForm({ ...benefitForm, employee_id: e.target.value })}
                  required
                >
                  <option value="">Select…</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.first_name} {e.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Benefit name</label>
                <input
                  value={benefitForm.benefit_name}
                  onChange={(e) => setBenefitForm({ ...benefitForm, benefit_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Amount (₱)</label>
                <input
                  type="number"
                  step="0.01"
                  value={benefitForm.amount}
                  onChange={(e) => setBenefitForm({ ...benefitForm, amount: e.target.value })}
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">
              Enroll
            </button>
          </form>
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Benefit</th>
                  <th>Amount</th>
                  <th>Frequency</th>
                </tr>
              </thead>
              <tbody>
                {benefits.map((b) => (
                  <tr key={b.id}>
                    <td>
                      {b.first_name} {b.last_name}
                    </td>
                    <td>{b.benefit_name}</td>
                    <td>{money(b.amount)}</td>
                    <td>{b.frequency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === '13th' && canManage && (
        <form
          className="card"
          onSubmit={async (e) => {
            e.preventDefault()
            setError(null)
            setBusy(true)
            try {
              const run = await api<PayrollRun>('/payroll/runs', {
                method: 'POST',
                body: JSON.stringify({ ...thirteenthForm, run_type: '13th_month' }),
              })
              await api(`/payroll/${run.id}/generate-payslips`, { method: 'POST', body: '{}' })
              setTab('runs')
              setSelectedRun(run.id)
              await load()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not generate 13th month')
            } finally {
              setBusy(false)
            }
          }}
        >
          <h3 className="section-title">13th month payroll</h3>
          <p className="muted-block" style={{ marginBottom: '1rem' }}>
            Computes 1/12 of total basic pay earned this calendar year from regular payroll runs.
          </p>
          <div className="form-row">
            <div className="form-group">
              <label>Branch</label>
              <select
                value={thirteenthForm.branch_id}
                onChange={(e) => setThirteenthForm({ ...thirteenthForm, branch_id: e.target.value })}
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
              label="Period start"
              value={thirteenthForm.period_start}
              onChange={(v) => setThirteenthForm({ ...thirteenthForm, period_start: v })}
              required
            />
            <DatePicker
              label="Period end"
              value={thirteenthForm.period_end}
              onChange={(v) => setThirteenthForm({ ...thirteenthForm, period_end: v })}
              min={thirteenthForm.period_start || undefined}
              required
            />
            <DatePicker
              label="Pay date"
              value={thirteenthForm.pay_date}
              onChange={(v) => setThirteenthForm({ ...thirteenthForm, pay_date: v })}
              min={thirteenthForm.period_end || thirteenthForm.period_start || undefined}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Create &amp; generate 13th month payslips
          </button>
        </form>
      )}

      <PayslipDetailModal
        open={detailId != null}
        payslipId={detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  )
}
