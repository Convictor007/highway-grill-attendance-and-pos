import { useCallback, useEffect, useState } from 'react'
import { formatPayrollPeriod } from '../lib/datetime'
import { api } from '../lib/api'
import { type LoadOptions, resolveLoadBehavior } from '../lib/scroll'
import { useNotification } from '../hooks/useNotification'
import { LoadingBlock } from './LoadingBlock'
import { Modal } from './Modal'
import type { PayrollPrepareData, Payslip } from '../types/hrms'

type DeductionForm = {
  sss_amount: string
  philhealth_amount: string
  pagibig_amount: string
  tax_amount: string
  loan_deduction: string
  cash_advance: string
  housing_deduction: string
}

function deductionsFromPrepare(res: PayrollPrepareData): DeductionForm {
  const ps = res.payslip
  const p = res.preview
  return {
    sss_amount: String(ps?.sss_amount ?? p.sss_amount ?? ''),
    philhealth_amount: String(ps?.philhealth_amount ?? p.philhealth_amount ?? ''),
    pagibig_amount: String(ps?.pagibig_amount ?? p.pagibig_amount ?? ''),
    tax_amount: String(ps?.tax_amount ?? p.tax_amount ?? ''),
    loan_deduction: String(ps?.loan_deduction ?? p.loan_deduction ?? ''),
    cash_advance: String(ps?.cash_advance ?? p.cash_advance ?? ''),
    housing_deduction: String(ps?.housing_deduction ?? p.housing_deduction ?? ''),
  }
}

function computeNetPreview(gross: number, d: DeductionForm): number {
  const total =
    (Number(d.sss_amount) || 0) +
    (Number(d.philhealth_amount) || 0) +
    (Number(d.pagibig_amount) || 0) +
    (Number(d.tax_amount) || 0) +
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
    sss_amount: '',
    philhealth_amount: '',
    pagibig_amount: '',
    tax_amount: '',
    loan_deduction: '',
    cash_advance: '',
    housing_deduction: '',
  })
  const patchDeductions = (patch: Partial<DeductionForm>) => {
    setDeductions((prev) => ({ ...prev, ...patch }))
  }

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
            sss_amount: Number(deductions.sss_amount) || 0,
            philhealth_amount: Number(deductions.philhealth_amount) || 0,
            pagibig_amount: Number(deductions.pagibig_amount) || 0,
            tax_amount: Number(deductions.tax_amount) || 0,
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
          sss_amount: Number(deductions.sss_amount) || 0,
          philhealth_amount: Number(deductions.philhealth_amount) || 0,
          pagibig_amount: Number(deductions.pagibig_amount) || 0,
          tax_amount: Number(deductions.tax_amount) || 0,
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
  const netPreview = computeNetPreview(grossPreview, deductions)
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
      size="large"
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
            <h4 className="subsection-title">Deductions (edit before generate)</h4>
            <div className="form-row">
              <div className="form-group">
                <label>SSS</label>
                <input
                  type="number"
                  step="0.01"
                  value={deductions.sss_amount}
                  disabled={!canEdit}
                  onChange={(e) => patchDeductions({ sss_amount: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>PhilHealth</label>
                <input
                  type="number"
                  step="0.01"
                  value={deductions.philhealth_amount}
                  disabled={!canEdit}
                  onChange={(e) => patchDeductions({ philhealth_amount: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Pag-IBIG</label>
                <input
                  type="number"
                  step="0.01"
                  value={deductions.pagibig_amount}
                  disabled={!canEdit}
                  onChange={(e) => patchDeductions({ pagibig_amount: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Tax</label>
                <input
                  type="number"
                  step="0.01"
                  value={deductions.tax_amount}
                  disabled={!canEdit}
                  onChange={(e) => patchDeductions({ tax_amount: e.target.value })}
                />
              </div>
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
        </>
      )}
    </Modal>
  )
}
