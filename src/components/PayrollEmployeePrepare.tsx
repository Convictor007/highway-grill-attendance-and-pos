import { useCallback, useEffect, useState } from 'react'
import { formatPayrollPeriod } from '../lib/datetime'
import { api } from '../lib/api'
import { type LoadOptions, resolveLoadBehavior } from '../lib/scroll'
import { useNotification } from '../hooks/useNotification'
import { LoadingBlock } from './LoadingBlock'
import { Modal } from './Modal'
import type { PayrollPrepareData, Payslip } from '../types/hrms'

type DeductionForm = {
  loan_deduction: string
  cash_advance: string
  housing_deduction: string
}

function deductionsFromPrepare(res: PayrollPrepareData): DeductionForm {
  const ps = res.payslip
  const p = res.preview
  return {
    loan_deduction: String(ps?.loan_deduction ?? p.loan_deduction ?? ''),
    cash_advance: String(ps?.cash_advance ?? p.cash_advance ?? ''),
    housing_deduction: String(ps?.housing_deduction ?? p.housing_deduction ?? ''),
  }
}

// Statutory deductions (SSS/PhilHealth/Pag-IBIG/tax) are managed in Benefits and
// resolved by the backend, so the net preview reads them from the server preview.
function computeNetPreview(gross: number, statutory: number, d: DeductionForm): number {
  const total =
    statutory +
    (Number(d.loan_deduction) || 0) +
    (Number(d.cash_advance) || 0) +
    (Number(d.housing_deduction) || 0)
  return Math.max(0, Math.round((gross - total) * 100) / 100)
}

type Props = {
  open: boolean
  runId: string
  employeeId: string
  canEdit: boolean
  onClose: () => void
  onSaved: () => void
  onViewPayslip?: (payslipId: string) => void
}

function money(value: number | string | undefined | null) {
  if (value == null || value === '') return '—'
  return `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso.replace(' ', 'T')).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatDay(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function PayrollEmployeePrepare({
  open,
  runId,
  employeeId,
  canEdit,
  onClose,
  onSaved,
  onViewPayslip,
}: Props) {
  const { success, error: notifyError } = useNotification()
  const [data, setData] = useState<PayrollPrepareData | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [included, setIncluded] = useState<Set<string>>(new Set())
  const [deductions, setDeductions] = useState<DeductionForm>({
    loan_deduction: '',
    cash_advance: '',
    housing_deduction: '',
  })
  const patchDeductions = (patch: Partial<DeductionForm>) => {
    setDeductions((prev) => ({ ...prev, ...patch }))
  }
  const [activeTab, setActiveTab] = useState<'attendance' | 'deductions'>('attendance')

  const load = useCallback(
    async (dates?: string[], options?: LoadOptions) => {
      if (!runId || !employeeId) return
      const { showLoading, finish } = resolveLoadBehavior(options)
      if (showLoading) setLoading(true)
      setLoadFailed(false)
      try {
        const attendanceEdit = dates !== undefined
        const q = attendanceEdit
          ? `&included_dates=${encodeURIComponent(dates.join(','))}`
          : ''
        const res = await api<PayrollPrepareData>(
          `/payroll/prepare?run_id=${encodeURIComponent(runId)}&employee_id=${encodeURIComponent(employeeId)}${q}`
        )
        setData(res)
        setIncluded(new Set(res.included_dates))
        setDeductions(deductionsFromPrepare(res))
      } catch (err) {
        setData(null)
        setLoadFailed(true)
        notifyError(err instanceof Error ? err.message : 'Could not load employee payroll data')
      } finally {
        setLoading(false)
        finish()
      }
    },
    [runId, employeeId, notifyError]
  )

  useEffect(() => {
    if (!open || !employeeId) {
      setData(null)
      setLoadFailed(false)
      setLoading(false)
      return
    }
    setActiveTab('attendance')
    load()
  }, [open, employeeId, load])

  const toggleDate = (date: string, checked: boolean) => {
    const next = new Set(included)
    if (checked) next.add(date)
    else next.delete(date)
    setIncluded(next)
    load([...next], { silent: true })
  }

  const onGenerate = async () => {
    setBusy(true)
    try {
      await api<{ payslip: Payslip | null }>(`/payroll/${runId}/generate-payslip`, {
        method: 'POST',
        body: JSON.stringify({
          employee_id: employeeId,
          included_dates: [...included],
          overrides: {
            loan_deduction: Number(deductions.loan_deduction) || 0,
            cash_advance: Number(deductions.cash_advance) || 0,
            housing_deduction: Number(deductions.housing_deduction) || 0,
          },
        }),
      })
      onSaved()
      await load(undefined, { silent: true })
      success(
        data?.payslip?.id
          ? 'Payslip regenerated from attendance. Totals updated below.'
          : 'Payslip generated. Review totals and pay from the roster when ready.'
      )
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not generate payslip')
    } finally {
      setBusy(false)
    }
  }

  const onSaveExisting = async () => {
    if (!data?.payslip?.id) return
    setBusy(true)
    try {
      const updated = await api<Payslip>(`/payroll/payslip/${data.payslip.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          other_deductions:
            Number(deductions.loan_deduction || 0)
            + Number(deductions.cash_advance || 0)
            + Number(deductions.housing_deduction || 0),
        }),
      })
      onSaved()
      await load(undefined, { silent: true })
      success(`Deductions saved. Net pay is now ${money(updated.net_pay)}.`)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not save payslip')
    } finally {
      setBusy(false)
    }
  }

  const emp = data?.employee
  const preview = data?.preview
  const unit = data?.pay_basis === 'daily' ? 'days' : 'hours'
  const counted = data
    ? data.pay_basis === 'daily'
      ? included.size
      : preview?.regular_hours ?? 0
    : 0
  const grossPreview = Number(preview?.gross_pay ?? 0)
  const statutory = {
    sss: Number(preview?.sss_amount ?? 0),
    philhealth: Number(preview?.philhealth_amount ?? 0),
    pagibig: Number(preview?.pagibig_amount ?? 0),
    tax: Number(preview?.tax_amount ?? 0),
  }
  const statutoryTotal = statutory.sss + statutory.philhealth + statutory.pagibig + statutory.tax
  const netPreview = computeNetPreview(grossPreview, statutoryTotal, deductions)
  const savedNet = data?.payslip?.net_pay != null ? Number(data.payslip.net_pay) : null

  const title = emp ? `${emp.first_name} ${emp.last_name}` : 'Prepare payslip'

  const metaLine = emp
    ? [
        emp.emp_number,
        emp.position_title,
        emp.department_name,
        data?.pay_basis === 'daily' ? `₱${data.pay_rate}/day` : `₱${data?.pay_rate}/hr`,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  const footer =
    canEdit && data ? (
      <div className="payroll-prepare-actions">
        {data.payslip?.id ? (
          <>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={onSaveExisting}>
              Save deduction changes
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => onViewPayslip?.(data.payslip!.id)}
            >
              View payslip
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={onGenerate}>
              Regenerate from attendance
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || included.size === 0}
            onClick={onGenerate}
          >
            Generate payslip for this employee
          </button>
        )}
      </div>
    ) : undefined

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      size="full"
      panelClassName="payroll-prepare-modal"
      footer={footer}
    >
      {loading && !data && <LoadingBlock label="Loading employee payroll…" />}

      {!loading && !data && loadFailed && (
        <p className="muted-block">Employee payroll data could not be loaded.</p>
      )}

      {data && preview && (
        <>
          {metaLine && (
            <p className="muted-block payroll-prepare-meta">{metaLine}</p>
          )}

          <p className="form-hint payroll-prepare-hint">
            Period {formatPayrollPeriod(data.run.period_start, data.run.period_end)}. Check which dates count toward pay, then review or
            edit deductions before generating this employee&apos;s payslip.
          </p>

          <div className="tabs payroll-prepare-tabs" role="tablist" aria-label="Payroll sections">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'attendance'}
              className={`tab ${activeTab === 'attendance' ? 'active' : ''}`}
              onClick={() => setActiveTab('attendance')}
            >
              Attendance
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'deductions'}
              className={`tab ${activeTab === 'deductions' ? 'active' : ''}`}
              onClick={() => setActiveTab('deductions')}
            >
              Deductions
            </button>
          </div>

          {activeTab === 'attendance' && (
            <div role="tabpanel">
              <div className="table-wrap payroll-prepare-attendance">
                <table>
                  <thead>
                    <tr>
                      <th>Include</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Time in</th>
                      <th>Time out</th>
                      <th>Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.attendance.map((day) => (
                      <tr key={day.date} className={day.present ? '' : 'payroll-day-absent'}>
                        <td>
                          <input
                            type="checkbox"
                            checked={included.has(day.date)}
                            disabled={!canEdit || !day.present}
                            onChange={(e) => toggleDate(day.date, e.target.checked)}
                            aria-label={`Include ${day.date}`}
                          />
                        </td>
                        <td>{formatDay(day.date)}</td>
                        <td>{day.present ? 'Present' : 'No record'}</td>
                        <td>{formatTime(day.clock_in)}</td>
                        <td>{formatTime(day.clock_out)}</td>
                        <td>{day.present ? Number(day.actual_hours).toFixed(2) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="muted-block payroll-prepare-count">
                Pay basis: <strong>{counted}</strong> {unit} selected
                {' · '}
                Basic pay preview: <strong>{money(preview.basic_pay)}</strong>
                {' · '}
                Gross: <strong>{money(preview.gross_pay)}</strong>
              </p>
            </div>
          )}

          {activeTab === 'deductions' && (
            <div role="tabpanel">
              {data.loans.length > 0 && (
                <div className="payroll-prepare-loans">
                  <h4 className="subsection-title">Active loans</h4>
                  <ul>
                    {data.loans.map((l) => (
                      <li key={l.id}>
                        {l.loan_type ?? 'Loan'} — balance {money(l.balance)}, monthly {money(l.monthly_deduction)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="payroll-prepare-deductions">
                <h4 className="subsection-title">Statutory deductions</h4>
                <p className="form-hint">
                  Managed in <strong>Benefits</strong> and applied automatically. Edit member IDs and
                  amounts there.
                </p>
                <ul className="payroll-statutory-list">
                  <li>
                    <span>SSS</span>
                    <strong>{money(statutory.sss)}</strong>
                  </li>
                  <li>
                    <span>PhilHealth</span>
                    <strong>{money(statutory.philhealth)}</strong>
                  </li>
                  <li>
                    <span>Pag-IBIG</span>
                    <strong>{money(statutory.pagibig)}</strong>
                  </li>
                  <li>
                    <span>Tax</span>
                    <strong>{money(statutory.tax)}</strong>
                  </li>
                </ul>

                <h4 className="subsection-title">Other deductions (edit before generate)</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Loan deduction</label>
                    <input
                      type="number"
                      step="0.01"
                      value={deductions.loan_deduction}
                      disabled={!canEdit}
                      onChange={(e) => patchDeductions({ loan_deduction: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Cash advance</label>
                    <input
                      type="number"
                      step="0.01"
                      value={deductions.cash_advance}
                      disabled={!canEdit}
                      onChange={(e) => patchDeductions({ cash_advance: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Housing / stay-in (HSNG)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={deductions.housing_deduction}
                      disabled={!canEdit}
                      onChange={(e) => patchDeductions({ housing_deduction: e.target.value })}
                    />
                  </div>
                </div>
                <p className="payroll-prepare-net">
                  Net pay preview: <strong>{money(netPreview)}</strong>
                  {savedNet != null && Math.abs(savedNet - netPreview) > 0.009 && (
                    <span className="muted-inline" style={{ marginLeft: '0.5rem' }}>
                      (saved: {money(savedNet)} — click Save to apply edits)
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
