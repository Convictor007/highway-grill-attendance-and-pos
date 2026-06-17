import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useNotification } from '../../hooks/useNotification'
import { hasPermission } from '../../lib/auth'
import { PageHeader } from '../../components/PageHeader'
import { PayrollRunsSection } from '../../components/PayrollRunsSection'
import { DatePicker } from '../../components/DatePicker'
import type { Branch, Employee, PayrollAdjustment, PayrollRun } from '../../types/hrms'

function money(value: string | number | undefined | null) {
  if (value == null || value === '') return '—'
  return `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

type PayrollTab = 'runs' | 'adjustments' | '13th'

export function PayrollPage() {
  const { user } = useAuth()
  const { success, error: notifyError, confirm } = useNotification()
  const canManage = hasPermission(user, 'payroll.manage')
  const [tab, setTab] = useState<PayrollTab>('runs')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [adjustments, setAdjustments] = useState<PayrollAdjustment[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [runModalOpen, setRunModalOpen] = useState(false)
  const [openRunId, setOpenRunId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [adjForm, setAdjForm] = useState({
    employee_id: '',
    adj_type: 'allowance',
    amount: '',
    description: '',
    recurring: true,
  })
  const [thirteenthForm, setThirteenthForm] = useState({
    branch_id: '',
    period_start: '',
    period_end: '',
    pay_date: '',
  })

  const loadExtras = async () => {
    const [adj, emps] = await Promise.all([
      api<PayrollAdjustment[]>('/payroll/adjustments?recurring=1').catch(() => []),
      api<Employee[]>('/employees?status=active').catch(() => []),
    ])
    setAdjustments(adj)
    setEmployees(emps)
  }

  const load = async () => {
    const b = await api<Branch[]>('/branches')
    setBranches(b)
    if (b[0] && !thirteenthForm.branch_id) setThirteenthForm((f) => ({ ...f, branch_id: b[0].id }))
    if (canManage) await loadExtras()
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle="Review attendance per employee, edit deductions, then generate payslips"
        actions={
          canManage && tab === 'runs' ? (
            <button type="button" className="btn btn-primary" onClick={() => setRunModalOpen(true)}>
              New semi-monthly run
            </button>
          ) : undefined
        }
      />

      {canManage && (
        <p className="form-hint" style={{ marginBottom: '1rem' }}>
          SSS, PhilHealth, Pag-IBIG IDs and allowances are managed in{' '}
          <Link to="/hr/benefits" className="text-link">
            Benefits
          </Link>
          .
        </p>
      )}

      {canManage && (
        <div className="tabs" style={{ marginBottom: '1rem' }}>
          {(['runs', 'adjustments', '13th'] as PayrollTab[]).map((t) => (
            <button key={t} type="button" className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === '13th' ? '13th month' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      )}

      {tab === 'runs' && (
        <PayrollRunsSection
          canManage={canManage}
          branches={branches}
          runModalOpen={runModalOpen}
          onRunModalOpenChange={setRunModalOpen}
          initialRunId={openRunId}
          onInitialRunConsumed={() => setOpenRunId(null)}
        />
      )}

      {tab === 'adjustments' && canManage && (
        <div className="stack">
          <form
            className="card"
            onSubmit={async (e) => {
              e.preventDefault()
              try {
                await api('/payroll/adjustments', {
                  method: 'POST',
                  body: JSON.stringify({
                    employee_id: adjForm.employee_id,
                    adj_type: adjForm.adj_type,
                    amount: Number(adjForm.amount),
                    description: adjForm.description || undefined,
                    payroll_run_id: adjForm.recurring ? null : undefined,
                  }),
                })
                success('Adjustment saved')
                await loadExtras()
                setAdjForm({ employee_id: '', adj_type: 'allowance', amount: '', description: '', recurring: true })
              } catch (err) {
                notifyError(err instanceof Error ? err.message : 'Could not save adjustment')
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
                          if (!(await confirm('Remove adjustment?', { variant: 'danger', confirmLabel: 'Remove' })))
                            return
                          await api(`/payroll/adjustments/${a.id}`, { method: 'DELETE' })
                          success('Adjustment removed')
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

      {tab === '13th' && canManage && (
        <form
          className="card"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            try {
              const run = await api<PayrollRun>('/payroll/runs', {
                method: 'POST',
                body: JSON.stringify({ ...thirteenthForm, run_type: '13th_month' }),
              })
              await api(`/payroll/${run.id}/generate-payslips`, { method: 'POST', body: '{}' })
              success('13th month payroll run created')
              setTab('runs')
              setOpenRunId(run.id)
            } catch (err) {
              notifyError(err instanceof Error ? err.message : 'Could not generate 13th month')
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
    </div>
  )
}
