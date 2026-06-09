import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmptyState } from '../../components/EmptyState'
import { LoanPaymentsModal } from '../../components/LoanPaymentsModal'
import { Spinner } from '../../components/Spinner'
import { useNotification } from '../../hooks/useNotification'
import {
  LOAN_MIN_AMOUNT,
  deductionPerPeriod,
  repaymentTermSummary,
  type RepaymentSchedule,
} from '../../lib/loanTerms'

interface Loan {
  id: string
  loan_type: string
  principal: string
  balance: string
  term_months: number
  repayment_schedule?: RepaymentSchedule
  term_duration?: number
  monthly_deduction: string
  purpose: string | null
  status: string
  created_at: string
}

function money(v: string | number) {
  return `₱${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

function loanTypeLabel(type: string) {
  return type === 'cash_advance' ? 'Cash advance' : 'Salary loan'
}

export function LoansPage() {
  const { success, error: notifyError } = useNotification()
  const [rows, setRows] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    loan_type: 'cash_advance',
    principal: '',
    repayment_schedule: 'semi_monthly' as RepaymentSchedule,
    term_duration: '2',
    purpose: '',
  })
  const [paymentsLoanId, setPaymentsLoanId] = useState<string | null>(null)
  const [paymentsLabel, setPaymentsLabel] = useState<string | null>(null)

  const principalNum = Number(form.principal) || 0
  const durationNum = form.repayment_schedule === 'one_month' ? 1 : Number(form.term_duration) || 1

  const previewDeduction = useMemo(() => {
    if (principalNum < LOAN_MIN_AMOUNT) return null
    return deductionPerPeriod(principalNum, form.repayment_schedule, durationNum)
  }, [principalNum, form.repayment_schedule, durationNum])

  const load = async () => {
    setLoading(true)
    try {
      const data = await api<Loan[]>('/loans')
      setRows(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (principalNum < LOAN_MIN_AMOUNT) {
      notifyError(`Minimum amount is ₱${LOAN_MIN_AMOUNT}`)
      return
    }
    setSubmitting(true)
    try {
      await api('/loans/apply', {
        method: 'POST',
        body: JSON.stringify({
          loan_type: form.loan_type,
          principal: principalNum,
          repayment_schedule: form.repayment_schedule,
          term_duration: durationNum,
          purpose: form.purpose.trim() || undefined,
        }),
      })
      success('Loan application submitted')
      setForm({
        loan_type: 'cash_advance',
        principal: '',
        repayment_schedule: 'semi_monthly',
        term_duration: '2',
        purpose: '',
      })
      load()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not submit application')
    } finally {
      setSubmitting(false)
    }
  }

  const active = rows.filter((r) => r.status === 'active')
  const pending = rows.filter((r) => r.status === 'pending')

  return (
    <div>
      <PageHeader title="Loans" subtitle="Salary loans and cash advances" />

      {active.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h2 className="section-title">Active balance</h2>
          <p className="stat-num" style={{ fontSize: '1.75rem' }}>
            {money(active.reduce((s, l) => s + Number(l.balance), 0).toString())}
          </p>
          <p className="muted-block">Total remaining across active loans</p>
        </div>
      )}

      <form className="card" onSubmit={onSubmit} style={{ marginBottom: '1rem' }}>
        <h2 className="section-title">Apply for cash advance / loan</h2>
        <p className="muted-block" style={{ marginBottom: '1rem' }}>
          Minimum amount ₱{LOAN_MIN_AMOUNT}. Deductions apply on each semi-monthly payroll cutoff.
        </p>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="loan-type">Type</label>
            <select
              id="loan-type"
              value={form.loan_type}
              onChange={(e) => setForm((f) => ({ ...f, loan_type: e.target.value }))}
            >
              <option value="cash_advance">Cash advance</option>
              <option value="salary">Salary loan</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="loan-amount">Amount (₱)</label>
            <input
              id="loan-amount"
              type="number"
              min={LOAN_MIN_AMOUNT}
              step="100"
              required
              value={form.principal}
              onChange={(e) => setForm((f) => ({ ...f, principal: e.target.value }))}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="loan-schedule">Repayment term</label>
            <select
              id="loan-schedule"
              value={form.repayment_schedule}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  repayment_schedule: e.target.value as RepaymentSchedule,
                }))
              }
            >
              <option value="semi_monthly">Semi-monthly</option>
              <option value="one_month">1 month</option>
            </select>
          </div>
          {form.repayment_schedule === 'semi_monthly' ? (
            <div className="form-group">
              <label htmlFor="loan-duration">Duration (cutoffs)</label>
              <select
                id="loan-duration"
                value={form.term_duration}
                onChange={(e) => setForm((f) => ({ ...f, term_duration: e.target.value }))}
              >
                {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={String(n)}>
                    {n} semi-monthly cutoff{n === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="form-group">
              <label>Duration</label>
              <p className="muted-block" style={{ margin: '0.5rem 0 0', fontSize: '0.88rem' }}>
                1 month (2 semi-monthly cutoffs)
              </p>
            </div>
          )}
        </div>

        {previewDeduction != null && (
          <p className="muted-block" style={{ marginBottom: '1rem' }}>
            {repaymentTermSummary(form.repayment_schedule, durationNum)} ·{' '}
            <strong>{money(previewDeduction)}</strong> per cutoff
          </p>
        )}

        <div className="form-group">
          <label htmlFor="loan-purpose">Purpose (optional)</label>
          <textarea
            id="loan-purpose"
            rows={2}
            placeholder="e.g. medical, family emergency"
            value={form.purpose}
            onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? (
            <>
              <Spinner size="sm" />
              Submitting…
            </>
          ) : (
            'Submit application'
          )}
        </button>
      </form>

      <div className="card table-wrap">
        <h2 className="section-title">My loans</h2>
        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState title="No loans" description="Submit an application when you need a salary loan or advance." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Principal</th>
                <th>Balance</th>
                <th>Term</th>
                <th>Per cutoff</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{loanTypeLabel(r.loan_type)}</td>
                  <td>{money(r.principal)}</td>
                  <td>{money(r.balance)}</td>
                  <td>
                    {r.repayment_schedule
                      ? repaymentTermSummary(r.repayment_schedule, r.term_duration ?? r.term_months)
                      : `${r.term_months} cutoff(s)`}
                  </td>
                  <td>{money(r.monthly_deduction)}</td>
                  <td>
                    <span className={`badge badge-${r.status === 'active' ? 'approved' : r.status}`}>
                      {r.status}
                    </span>
                  </td>
                  <td>
                    {['active', 'paid'].includes(r.status) && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setPaymentsLoanId(r.id)
                          setPaymentsLabel(`${loanTypeLabel(r.loan_type)} · ${money(r.principal)}`)
                        }}
                      >
                        Payments
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {pending.length > 0 && (
          <p className="muted-block" style={{ marginTop: '0.75rem' }}>
            {pending.length} application(s) awaiting HR approval.
          </p>
        )}
      </div>

      <LoanPaymentsModal
        open={paymentsLoanId != null}
        loanId={paymentsLoanId}
        loanLabel={paymentsLabel}
        onClose={() => {
          setPaymentsLoanId(null)
          setPaymentsLabel(null)
        }}
      />
    </div>
  )
}
