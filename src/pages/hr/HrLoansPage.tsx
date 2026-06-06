import { useEffect, useState } from 'react'
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
  monthly_deduction: string
  purpose: string | null
  status: string
  first_name?: string
  last_name?: string
  emp_number?: string
}

export function HrLoansPage() {
  const [rows, setRows] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [paymentsLoanId, setPaymentsLoanId] = useState<string | null>(null)
  const [paymentsLabel, setPaymentsLabel] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setRows(await api<Loan[]>('/loans'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const review = async (id: string, status: 'approved' | 'rejected') => {
    await api(`/loans/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
    load()
  }

  const pending = rows.filter((r) => r.status === 'pending')
  const active = rows.filter((r) => r.status === 'active')

  const openPayments = (r: Loan) => {
    setPaymentsLoanId(r.id)
    setPaymentsLabel(`${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || r.emp_number || 'Loan')
  }

  return (
    <div>
      <PageHeader title="Loan applications" subtitle="Approve or reject employee loan requests" />
      <div className="card table-wrap">
        {loading ? (
          <LoadingBlock />
        ) : pending.length === 0 ? (
          <EmptyState title="No pending applications" description="New loan requests will appear here." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Monthly</th>
                <th>Purpose</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.first_name} {r.last_name}
                    <br />
                    <small style={{ color: 'var(--muted)' }}>{r.emp_number}</small>
                  </td>
                  <td>{r.loan_type}</td>
                  <td>₱{Number(r.principal).toLocaleString()}</td>
                  <td>₱{Number(r.monthly_deduction).toLocaleString()}</td>
                  <td>{r.purpose ?? '—'}</td>
                  <td>
                    <div className="quick-actions" style={{ margin: 0 }}>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => review(r.id, 'approved')}>
                        Approve
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => review(r.id, 'rejected')}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {active.length > 0 && (
        <div className="card table-wrap" style={{ marginTop: '1rem' }}>
          <h2 className="section-title">Active loans</h2>
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Balance</th>
                <th>Monthly deduction</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {active.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.first_name} {r.last_name}
                  </td>
                  <td>₱{Number(r.balance).toLocaleString()}</td>
                  <td>₱{Number(r.monthly_deduction).toLocaleString()}</td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openPayments(r)}>
                      Payments
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LoanPaymentsModal
        open={paymentsLoanId != null}
        loanId={paymentsLoanId}
        loanLabel={paymentsLabel}
        canRecord
        onClose={() => {
          setPaymentsLoanId(null)
          setPaymentsLabel(null)
        }}
        onRecorded={load}
      />
    </div>
  )
}
