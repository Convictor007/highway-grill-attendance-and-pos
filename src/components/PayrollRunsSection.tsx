import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useNotification } from '../hooks/useNotification'
import { buildQuery, DEFAULT_PAGE_SIZE } from '../lib/pagination'
import { PaginationBar } from './PaginationBar'
import { LoadingBlock } from './LoadingBlock'
import { PayslipDetailModal } from './PayslipDetailModal'
import { PayrollEmployeePrepare } from './PayrollEmployeePrepare'
import { PayrollRunCreateModal } from './PayrollRunCreateModal'
import type {
  PaginatedResult,
  PayrollDisbursementStatus,
  PayrollDisbursementSummary,
  PayrollRosterEntry,
  PayrollRun,
  Payslip,
  Branch,
} from '../types/hrms'

type RunsView = 'all' | 'workspace'
type WorkspaceTab = 'employees' | 'payslips'

type Props = {
  canManage: boolean
  branches: Branch[]
  runModalOpen: boolean
  onRunModalOpenChange: (open: boolean) => void
  /** Open workspace for this run (e.g. after creating 13th month). */
  initialRunId?: string | null
  onInitialRunConsumed?: () => void
}

function money(value: string | number | undefined | null) {
  if (value == null || value === '') return '—'
  return `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function paymentStatusLabel(status: PayrollDisbursementStatus) {
  if (status === 'pending') return 'No payslip'
  if (status === 'ready') return 'Ready to pay'
  if (status === 'paid') return 'Paid'
  return 'Deferred'
}

type PayslipDeliveryResult = {
  sent: number
  skipped: number
  failed: number
  details?: { employee_name?: string; status: string; reason?: string; email?: string }[]
}

function payslipDeliveryMessage(result: PayslipDeliveryResult): string {
  const lines = [`Payslips emailed: ${result.sent} sent, ${result.skipped} skipped, ${result.failed} failed.`]
  const issues = (result.details ?? []).filter((d) => d.status === 'failed' || d.status === 'skipped')
  if (issues.length > 0) {
    lines.push('')
    for (const item of issues) {
      lines.push(`${item.employee_name ?? 'Employee'}: ${item.reason ?? item.status}`)
    }
  }
  return lines.join('\n')
}

function useDebounced(value: string, ms = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function PayrollRunsSection({
  canManage,
  branches,
  runModalOpen,
  onRunModalOpenChange,
  initialRunId,
  onInitialRunConsumed,
}: Props) {
  const { success, error: notifyError, info, confirm } = useNotification()

  const [runsView, setRunsView] = useState<RunsView>('all')
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('employees')
  const [selectedRun, setSelectedRun] = useState('')
  const [selectedDetail, setSelectedDetail] = useState<PayrollRun | null>(null)
  const [stepsOpen, setStepsOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [runsLoading, setRunsLoading] = useState(false)
  const [runsSearch, setRunsSearch] = useState('')
  const [runsStatus, setRunsStatus] = useState('')
  const [runsBranch, setRunsBranch] = useState('')
  const [runsPage, setRunsPage] = useState(1)
  const [runsMeta, setRunsMeta] = useState({ total: 0, pages: 0, limit: DEFAULT_PAGE_SIZE })
  const runsQ = useDebounced(runsSearch)

  const [roster, setRoster] = useState<PayrollRosterEntry[]>([])
  const [rosterSummary, setRosterSummary] = useState<PayrollDisbursementSummary | null>(null)
  const [rosterLoading, setRosterLoading] = useState(false)
  const [rosterSearch, setRosterSearch] = useState('')
  const [rosterPage, setRosterPage] = useState(1)
  const [rosterMeta, setRosterMeta] = useState({ total: 0, pages: 0, limit: DEFAULT_PAGE_SIZE })
  const rosterQ = useDebounced(rosterSearch)

  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [payslipsLoading, setPayslipsLoading] = useState(false)
  const [payslipSearch, setPayslipSearch] = useState('')
  const [payslipPage, setPayslipPage] = useState(1)
  const [payslipMeta, setPayslipMeta] = useState({ total: 0, pages: 0, limit: DEFAULT_PAGE_SIZE })
  const payslipQ = useDebounced(payslipSearch)

  const [selectedRosterIds, setSelectedRosterIds] = useState<string[]>([])
  const [cashAvailable, setCashAvailable] = useState('')
  const [deferNote, setDeferNote] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const selectedReadyNet = useMemo(() => {
    return roster
      .filter((e) => selectedRosterIds.includes(e.employee_id) && e.payment_status === 'ready')
      .reduce((sum, e) => sum + (e.payslip_net ?? 0), 0)
  }, [roster, selectedRosterIds])

  const cashAvailableNum = Number(cashAvailable) || 0
  const cashShortfall = cashAvailableNum > 0 && selectedReadyNet > cashAvailableNum

  const loadRuns = useCallback(async () => {
    setRunsLoading(true)
    try {
      const data = await api<PaginatedResult<PayrollRun>>(
        `/payroll/runs${buildQuery({
          q: runsQ,
          status: runsStatus,
          branch_id: runsBranch,
          page: runsPage,
          limit: DEFAULT_PAGE_SIZE,
        })}`
      )
      setRuns(data.items)
      setRunsMeta({ total: data.total, pages: data.pages, limit: data.limit })
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not load payroll runs')
    } finally {
      setRunsLoading(false)
    }
  }, [runsQ, runsStatus, runsBranch, runsPage, notifyError])

  const loadRoster = useCallback(async () => {
    if (!selectedRun) {
      setRoster([])
      setRosterSummary(null)
      return
    }
    setRosterLoading(true)
    try {
      const data = await api<{
        employees: PayrollRosterEntry[]
        summary: PayrollDisbursementSummary
        total: number
        pages: number
        limit: number
      }>(
        `/payroll/run-roster${buildQuery({
          run_id: selectedRun,
          q: rosterQ,
          page: rosterPage,
          limit: DEFAULT_PAGE_SIZE,
        })}`
      )
      setRoster(data.employees ?? [])
      setRosterSummary(data.summary ?? null)
      setRosterMeta({ total: data.total, pages: data.pages, limit: data.limit })
    } catch (err) {
      setRoster([])
      setRosterSummary(null)
      notifyError(err instanceof Error ? err.message : 'Could not load employee roster')
    } finally {
      setRosterLoading(false)
    }
  }, [selectedRun, rosterQ, rosterPage, notifyError])

  const loadPayslips = useCallback(async () => {
    if (!selectedRun) {
      setPayslips([])
      return
    }
    setPayslipsLoading(true)
    try {
      const data = await api<PaginatedResult<Payslip>>(
        `/payroll/payslips${buildQuery({
          run_id: selectedRun,
          q: payslipQ,
          page: payslipPage,
          limit: DEFAULT_PAGE_SIZE,
        })}`
      )
      setPayslips(data.items)
      setPayslipMeta({ total: data.total, pages: data.pages, limit: data.limit })
    } catch (err) {
      setPayslips([])
      notifyError(err instanceof Error ? err.message : 'Could not load payslips')
    } finally {
      setPayslipsLoading(false)
    }
  }, [selectedRun, payslipQ, payslipPage, notifyError])

  const refreshWorkspace = useCallback(async () => {
    await Promise.all([loadRuns(), loadRoster(), loadPayslips()])
  }, [loadRuns, loadRoster, loadPayslips])

  useEffect(() => {
    loadRuns()
  }, [loadRuns])

  useEffect(() => {
    if (!selectedRun) {
      setSelectedDetail(null)
      return
    }
    const cached = runs.find((r) => r.id === selectedRun)
    if (cached) {
      setSelectedDetail(cached)
      return
    }
    api<PayrollRun>(`/payroll/runs/${selectedRun}`)
      .then(setSelectedDetail)
      .catch(() => setSelectedDetail(null))
  }, [selectedRun, runs])

  useEffect(() => {
    if (selectedDetail?.run_type === '13th_month') {
      setWorkspaceTab('payslips')
    }
  }, [selectedDetail?.id, selectedDetail?.run_type])

  useEffect(() => {
    if (runsView === 'workspace' && selectedRun) {
      loadRoster()
    }
  }, [runsView, selectedRun, loadRoster])

  useEffect(() => {
    if (runsView === 'workspace' && selectedRun && workspaceTab === 'payslips') {
      loadPayslips()
    }
  }, [runsView, selectedRun, workspaceTab, loadPayslips])

  useEffect(() => {
    setRunsPage(1)
  }, [runsQ, runsStatus, runsBranch])

  useEffect(() => {
    setRosterPage(1)
  }, [rosterQ, selectedRun])

  useEffect(() => {
    setPayslipPage(1)
  }, [payslipQ, selectedRun])

  const openRun = useCallback((runId: string) => {
    setSelectedRun(runId)
    setRunsView('workspace')
    setWorkspaceTab('employees')
    setSelectedEmployeeId(null)
    setSelectedRosterIds([])
    setRosterPage(1)
    setPayslipPage(1)
  }, [])

  useEffect(() => {
    if (!initialRunId) return
    openRun(initialRunId)
    onInitialRunConsumed?.()
  }, [initialRunId, openRun, onInitialRunConsumed])

  const onGenerate = async (replace = false) => {
    if (!selectedRun) return
    if (replace && !(await confirm('Replace all payslips for this run with fresh calculations from attendance?'))) return
    setBusy(true)
    try {
      await api(`/payroll/${selectedRun}/generate-payslips`, {
        method: 'POST',
        body: JSON.stringify({ replace }),
      })
      success('Payslips generated')
      await refreshWorkspace()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not generate payslips')
    } finally {
      setBusy(false)
    }
  }

  const updateRunStatus = async (status: PayrollRun['status']) => {
    if (!selectedRun) return
    const label =
      status === 'approved'
        ? 'Approve this payroll run?'
        : status === 'paid'
          ? 'Mark as paid and email payslips to employees?'
          : 'Cancel this run?'
    if (!(await confirm(label))) return
    setBusy(true)
    try {
      const body: { status: PayrollRun['status']; send_payslips?: boolean } = { status }
      if (status === 'paid') body.send_payslips = true
      const result = await api<{ payslip_delivery?: PayslipDeliveryResult }>(`/payroll/${selectedRun}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      if (result?.payslip_delivery) {
        info(payslipDeliveryMessage(result.payslip_delivery), 'Payslip delivery')
      } else {
        success('Payroll run updated')
      }
      await refreshWorkspace()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not update payroll run')
    } finally {
      setBusy(false)
    }
  }

  const onSendPayslips = async () => {
    if (!selectedRun) return
    if (!(await confirm('Email payslips (PDF) to all employees in this run?'))) return
    setBusy(true)
    try {
      const result = await api<PayslipDeliveryResult>(`/payroll/${selectedRun}/send-payslips`, {
        method: 'POST',
        body: '{}',
      })
      info(payslipDeliveryMessage(result), 'Payslip delivery')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not send payslips')
    } finally {
      setBusy(false)
    }
  }

  const toggleRosterSelect = (employeeId: string) => {
    setSelectedRosterIds((ids) =>
      ids.includes(employeeId) ? ids.filter((id) => id !== employeeId) : [...ids, employeeId]
    )
  }

  const toggleRosterSelectAll = () => {
    if (selectedRosterIds.length === roster.length) {
      setSelectedRosterIds([])
    } else {
      setSelectedRosterIds(roster.map((e) => e.employee_id))
    }
  }

  const onPaySelected = async () => {
    if (!selectedRun || selectedRosterIds.length === 0) return
    const readyIds = roster
      .filter((e) => selectedRosterIds.includes(e.employee_id) && e.payment_status === 'ready')
      .map((e) => e.employee_id)
    if (readyIds.length === 0) {
      notifyError('Select employees with ready payslips to pay now')
      return
    }
    if (
      cashShortfall &&
      !(await confirm(
        `Selected net (${money(selectedReadyNet)}) exceeds cash available (${money(cashAvailableNum)}). Pay anyway?`
      ))
    ) {
      return
    }
    if (!(await confirm(`Mark ${readyIds.length} employee(s) as paid and email payslips?`))) return
    setBusy(true)
    try {
      const result = await api<{ paid: number; emailed: number; skipped: number; failed: number }>(
        `/payroll/${selectedRun}/pay-selected`,
        { method: 'POST', body: JSON.stringify({ employee_ids: readyIds, send_payslips: true }) }
      )
      info(
        `Paid ${result.paid}. Emails: ${result.emailed} sent, ${result.skipped} skipped, ${result.failed} failed.`,
        'Payment complete'
      )
      setSelectedRosterIds([])
      await refreshWorkspace()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not pay selected employees')
    } finally {
      setBusy(false)
    }
  }

  const onDeferSelected = async () => {
    if (!selectedRun || selectedRosterIds.length === 0) return
    const ids = roster
      .filter(
        (e) =>
          selectedRosterIds.includes(e.employee_id) &&
          e.payment_status !== 'paid' &&
          e.payment_status !== 'deferred'
      )
      .map((e) => e.employee_id)
    if (ids.length === 0) {
      notifyError('Select employees who are not already paid or deferred')
      return
    }
    if (!(await confirm(`Defer pay for ${ids.length} employee(s) to the next run?`))) return
    setBusy(true)
    try {
      await api(`/payroll/${selectedRun}/defer`, {
        method: 'POST',
        body: JSON.stringify({ employee_ids: ids, note: deferNote || undefined }),
      })
      success('Employees deferred to next run')
      setSelectedRosterIds([])
      await refreshWorkspace()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not defer employees')
    } finally {
      setBusy(false)
    }
  }

  const onUndeferSelected = async () => {
    if (!selectedRun || selectedRosterIds.length === 0) return
    const ids = roster
      .filter((e) => selectedRosterIds.includes(e.employee_id) && e.payment_status === 'deferred')
      .map((e) => e.employee_id)
    if (ids.length === 0) {
      notifyError('Select deferred employees to restore')
      return
    }
    setBusy(true)
    try {
      await api(`/payroll/${selectedRun}/undefer`, {
        method: 'POST',
        body: JSON.stringify({ employee_ids: ids }),
      })
      success('Employees restored for payment')
      setSelectedRosterIds([])
      await refreshWorkspace()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not restore employees')
    } finally {
      setBusy(false)
    }
  }

  const onSendOnePayslip = async (payslipId: string) => {
    setBusy(true)
    try {
      const result = await api<{ status: string; reason?: string; email?: string }>(
        `/payroll/${payslipId}/send-payslip`,
        { method: 'POST', body: '{}' }
      )
      if (result.status === 'sent') {
        success(`Payslip emailed to ${result.email ?? 'employee'}.`)
      } else {
        notifyError(result.reason ?? 'Could not send payslip.')
      }
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not send payslip')
    } finally {
      setBusy(false)
    }
  }

  const selected = selectedDetail

  return (
    <>
      <div className="tabs tabs--sub" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className={`tab ${runsView === 'all' ? 'active' : ''}`}
          onClick={() => setRunsView('all')}
        >
          All runs
        </button>
        <button
          type="button"
          className={`tab ${runsView === 'workspace' ? 'active' : ''}`}
          disabled={!selectedRun}
          onClick={() => selectedRun && setRunsView('workspace')}
        >
          Run workspace
        </button>
      </div>

      {canManage && runsView === 'all' && (
        <div className={`card payroll-guide${stepsOpen ? ' payroll-guide--open' : ''}`} style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            className="payroll-guide-toggle"
            onClick={() => setStepsOpen((open) => !open)}
            aria-expanded={stepsOpen}
          >
            <span className="payroll-guide-title">Payroll steps</span>
          </button>
          {stepsOpen && (
            <ol className="payroll-guide-steps">
              <li>Create a semi-monthly run for the cutoff dates</li>
              <li>Open a run — review attendance and deductions per employee</li>
              <li>Generate payslips, then pay or defer when cash is limited</li>
            </ol>
          )}
        </div>
      )}

      {runsView === 'all' && (
        <div className="card table-wrap">
          <div className="list-toolbar">
            <h3 className="section-title" style={{ margin: 0 }}>
              All runs
            </h3>
            <div className="list-toolbar__filters">
              <input
                type="search"
                className="list-toolbar__search"
                placeholder="Search branch, period, status…"
                value={runsSearch}
                onChange={(e) => setRunsSearch(e.target.value)}
              />
              <select value={runsBranch} onChange={(e) => setRunsBranch(e.target.value)} aria-label="Branch filter">
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <select value={runsStatus} onChange={(e) => setRunsStatus(e.target.value)} aria-label="Status filter">
                <option value="">All statuses</option>
                {['draft', 'processing', 'partially_paid', 'paid', 'cancelled'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {runsLoading ? (
            <LoadingBlock label="Loading runs…" />
          ) : (
            <>
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
                    <tr
                      key={r.id}
                      className={`row-clickable${r.id === selectedRun ? ' row-selected' : ''}`}
                      onClick={() => openRun(r.id)}
                    >
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
              {runs.length === 0 && (
                <p className="muted-block" style={{ padding: '1rem 0' }}>
                  No payroll runs match your filters.
                </p>
              )}
              <PaginationBar
                page={runsPage}
                pages={runsMeta.pages}
                total={runsMeta.total}
                limit={runsMeta.limit}
                onPage={setRunsPage}
                disabled={runsLoading}
              />
            </>
          )}
        </div>
      )}

      {runsView === 'workspace' && selectedRun && selected && (
        <>
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
                <strong>{payslipMeta.total}</strong>
              </div>
            </div>

            {rosterSummary && (
              <div className="payroll-disburse-summary">
                <span>
                  <strong>{rosterSummary.pending}</strong> pending
                </span>
                <span>
                  <strong>{rosterSummary.ready}</strong> ready ({money(rosterSummary.net_ready)})
                </span>
                <span>
                  <strong>{rosterSummary.paid}</strong> paid ({money(rosterSummary.net_paid)})
                </span>
                <span>
                  <strong>{rosterSummary.deferred}</strong> deferred
                </span>
              </div>
            )}

            {canManage && (
              <div className="payroll-run-actions">
                {selected.status === 'draft' && selected.run_type !== '13th_month' && (
                  <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => onGenerate(false)}>
                    Generate all payslips
                  </button>
                )}
                {selected.status === 'draft' && selected.run_type === '13th_month' && (
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onGenerate(false)}>
                    Generate 13th month payslips
                  </button>
                )}
                {['processing', 'partially_paid'].includes(selected.status) && payslipMeta.total > 0 && (
                  <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => onGenerate(true)}>
                    Regenerate payslips
                  </button>
                )}
                {['processing', 'partially_paid', 'paid'].includes(selected.status) && payslipMeta.total > 0 && (
                  <button type="button" className="btn btn-ghost" disabled={busy} onClick={onSendPayslips}>
                    Email all payslips
                  </button>
                )}
                {!['paid', 'cancelled'].includes(selected.status) && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => updateRunStatus('cancelled')}
                  >
                    Cancel run
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="tabs tabs--sub" style={{ marginBottom: '1rem' }}>
            {selected.run_type !== '13th_month' && (
              <button
                type="button"
                className={`tab ${workspaceTab === 'employees' ? 'active' : ''}`}
                onClick={() => setWorkspaceTab('employees')}
              >
                Employees
              </button>
            )}
            <button
              type="button"
              className={`tab ${workspaceTab === 'payslips' ? 'active' : ''}`}
              onClick={() => setWorkspaceTab('payslips')}
            >
              Payslips
            </button>
          </div>

          {workspaceTab === 'employees' && selected.run_type !== '13th_month' && (
            <div className="card table-wrap" style={{ marginBottom: '1.5rem' }}>
              <div className="list-toolbar">
                <div>
                  <h3 className="section-title" style={{ margin: 0 }}>
                    Employees — review &amp; selective pay
                  </h3>
                  <p className="form-hint" style={{ margin: '0.35rem 0 0' }}>
                    Click a row to review attendance. Select employees to pay or defer.
                  </p>
                </div>
                <input
                  type="search"
                  className="list-toolbar__search"
                  placeholder="Search employee…"
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                />
              </div>

              {cashShortfall && (
                <p className="payroll-cash-warn">
                  Selected ready total {money(selectedReadyNet)} exceeds cash available {money(cashAvailableNum)}.
                </p>
              )}
              {selectedRosterIds.length > 0 && selectedReadyNet > 0 && (
                <p className="form-hint" style={{ marginTop: 0 }}>
                  Selected ready to pay: <strong>{money(selectedReadyNet)}</strong>
                </p>
              )}

              {canManage && !['paid', 'cancelled'].includes(selected.status) && (
                <div className="payroll-disburse-bar">
                  <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
                    <label>Cash available (optional)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 15000"
                      value={cashAvailable}
                      onChange={(ev) => setCashAvailable(ev.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
                    <label>Defer note (optional)</label>
                    <input
                      type="text"
                      placeholder="Pay next cutoff"
                      value={deferNote}
                      onChange={(ev) => setDeferNote(ev.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || selectedRosterIds.length === 0}
                    onClick={onPaySelected}
                  >
                    Pay selected &amp; email
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy || selectedRosterIds.length === 0}
                    onClick={onDeferSelected}
                  >
                    Defer selected
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy || selectedRosterIds.length === 0}
                    onClick={onUndeferSelected}
                  >
                    Undefer selected
                  </button>
                </div>
              )}

              {rosterLoading ? (
                <LoadingBlock label="Loading employees…" />
              ) : (
                <>
                  <table>
                    <thead>
                      <tr>
                        {canManage && (
                          <th style={{ width: 36 }}>
                            <input
                              type="checkbox"
                              aria-label="Select all on page"
                              checked={roster.length > 0 && selectedRosterIds.length === roster.length}
                              onChange={toggleRosterSelectAll}
                            />
                          </th>
                        )}
                        <th>Employee</th>
                        <th>Position</th>
                        <th>Rate</th>
                        <th>Days / hrs</th>
                        <th>Payment</th>
                        <th>Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map((e) => (
                        <tr
                          key={e.employee_id}
                          className={`row-clickable ${selectedEmployeeId === e.employee_id ? 'payroll-roster-row-selected' : ''}`}
                          onClick={() => setSelectedEmployeeId(e.employee_id)}
                        >
                          {canManage && (
                            <td onClick={(ev) => ev.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedRosterIds.includes(e.employee_id)}
                                onChange={() => toggleRosterSelect(e.employee_id)}
                              />
                            </td>
                          )}
                          <td>
                            <strong>
                              {e.first_name} {e.last_name}
                            </strong>
                            <br />
                            <span className="muted-inline">{e.emp_number}</span>
                          </td>
                          <td>{e.position_title ?? '—'}</td>
                          <td>{e.pay_basis === 'daily' ? `₱${e.pay_rate}/day` : `₱${e.pay_rate}/hr`}</td>
                          <td>{e.days_or_hours}</td>
                          <td>
                            <span className={`badge badge-${e.payment_status}`}>
                              {paymentStatusLabel(e.payment_status)}
                            </span>
                            {e.defer_note && (
                              <>
                                <br />
                                <span className="muted-inline">{e.defer_note}</span>
                              </>
                            )}
                          </td>
                          <td>{e.payslip_net != null ? money(e.payslip_net) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {roster.length === 0 && (
                    <p className="muted-block" style={{ padding: '1rem 0' }}>
                      No employees match your search.
                    </p>
                  )}
                  <PaginationBar
                    page={rosterPage}
                    pages={rosterMeta.pages}
                    total={rosterMeta.total}
                    limit={rosterMeta.limit}
                    onPage={setRosterPage}
                    disabled={rosterLoading}
                  />
                </>
              )}
            </div>
          )}

          {workspaceTab === 'payslips' && (
            <div className="card table-wrap">
              <div className="list-toolbar">
                <h3 className="section-title" style={{ margin: 0 }}>
                  Generated payslips
                </h3>
                <input
                  type="search"
                  className="list-toolbar__search"
                  placeholder="Search employee…"
                  value={payslipSearch}
                  onChange={(e) => setPayslipSearch(e.target.value)}
                />
              </div>

              {payslipsLoading ? (
                <LoadingBlock label="Loading payslips…" />
              ) : (
                <>
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
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {payslips.map((p) => (
                        <tr key={p.id} className="row-clickable" onClick={() => setDetailId(p.id)}>
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
                            {p.payment_status ? (
                              <span className={`badge badge-${p.payment_status}`}>
                                {paymentStatusLabel(p.payment_status)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            {p.payment_status === 'paid' && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={busy}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onSendOnePayslip(p.id)
                                }}
                              >
                                Email
                              </button>
                            )}
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
                    <p className="muted-block" style={{ padding: '1rem 0' }}>
                      No payslips yet. Review employees and generate from the Employees tab.
                    </p>
                  )}
                  <PaginationBar
                    page={payslipPage}
                    pages={payslipMeta.pages}
                    total={payslipMeta.total}
                    limit={payslipMeta.limit}
                    onPage={setPayslipPage}
                    disabled={payslipsLoading}
                  />
                </>
              )}
            </div>
          )}
        </>
      )}

      <PayrollEmployeePrepare
        open={runsView === 'workspace' && !!selectedEmployeeId && selected?.run_type !== '13th_month'}
        runId={selectedRun}
        employeeId={selectedEmployeeId ?? ''}
        canEdit={canManage && ['draft', 'processing', 'partially_paid'].includes(selected?.status ?? '')}
        onClose={() => setSelectedEmployeeId(null)}
        onSaved={() => refreshWorkspace()}
        onViewPayslip={(id) => setDetailId(id)}
      />

      <PayrollRunCreateModal
        open={runModalOpen}
        branches={branches}
        onClose={() => onRunModalOpenChange(false)}
        onCreated={async (run) => {
          openRun(run.id)
          await loadRuns()
        }}
      />

      <PayslipDetailModal open={detailId != null} payslipId={detailId} onClose={() => setDetailId(null)} />
    </>
  )
}
