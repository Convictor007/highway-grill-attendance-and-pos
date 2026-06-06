import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmptyState } from '../../components/EmptyState'
import { LoanPaymentsModal } from '../../components/LoanPaymentsModal'

interface Loan {
  id: string
  loan_type: string
  principal: string
  balance: string
  term_months: number
  monthly_deduction: string
  purpose: string | null
  status: string
  created_at: string
}

function money(v: string) {
  return `₱${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

export function LoansPage() {
  const [rows, setRows] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    loan_type: 'salary',
    principal: '',
    term_months: '6',
    purpose: '',
  })
  const [paymentsLoanId, setPaymentsLoanId] = useState<string | null>(null)
  const [paymentsLabel, setPaymentsLabel] = useState<string | null>(null)

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
    await api('/loans/apply', {
      method: 'POST',
      body: JSON.stringify({
        loan_type: form.loan_type,
        principal: Number(form.principal),
        term_months: Number(form.term_months),
        purpose: form.purpose || undefined,
      }),
    })
    setForm({ loan_type: 'salary', principal: '', term_months: '6', purpose: '' })
    load()
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
        <h2 className="section-title">Apply for a loan</h2>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="loan-type">Type</label>
            <select
              id="loan-type"
              value={form.loan_type}
              onChange={(e) => setForm((f) => ({ ...f, loan_type: e.target.value }))}
            >
              <option value="salary">Salary loan</option>
              <option value="cash_advance">Cash advance</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="loan-amount">Amount (₱)</label>
            <input
              id="loan-amount"
              type="number"
              min="500"
              step="100"
              required
              value={form.principal}
              onChange={(e) => setForm((f) => ({ ...f, principal: e.target.value }))}
            />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="loan-term">Term (months)</label>
          <input
            id="loan-term"
            type="number"
            min="1"
            max="24"
            value={form.term_months}
            onChange={(e) => setForm((f) => ({ ...f, term_months: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label htmlFor="loan-purpose">Purpose</label>
          <textarea
            id="loan-purpose"
            rows={2}
            value={form.purpose}
            onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Submit application
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
                <th>Monthly</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.loan_type === 'cash_advance' ? 'Cash advance' : 'Salary loan'}</td>
                  <td>{money(r.principal)}</td>
                  <td>{money(r.balance)}</td>
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
                          setPaymentsLabel(
                            `${r.loan_type === 'cash_advance' ? 'Cash advance' : 'Salary loan'} · ${money(r.principal)}`
                          )
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
