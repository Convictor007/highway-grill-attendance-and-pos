import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { Modal } from './Modal'

export interface LoanPayment {
  id: string
  loan_id: string
  amount: string
  paid_on: string
  notes: string | null
  created_at: string
}

type Props = {
  open: boolean
  loanId: string | null
  loanLabel?: string | null
  canRecord?: boolean
  onClose: () => void
  onRecorded?: () => void
}

function money(value: string | number) {
  return `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function LoanPaymentsModal({ open, loanId, loanLabel, canRecord, onClose, onRecorded }: Props) {
  const [rows, setRows] = useState<LoanPayment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ amount: '', paid_on: new Date().toISOString().slice(0, 10), notes: '' })

  const load = () => {
    if (!loanId) return
    setLoading(true)
    setError(null)
    api<LoanPayment[]>(`/loans/${loanId}/payments`)
      .then(setRows)
      .catch((err) => {
        setRows([])
        setError(err instanceof Error ? err.message : 'Could not load payments')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!open || !loanId) {
      setRows([])
      setError(null)
      return
    }
    load()
  }, [open, loanId])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!loanId || !canRecord) return
    setBusy(true)
    setError(null)
    try {
      await api(`/loans/${loanId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(form.amount),
          paid_on: form.paid_on,
          notes: form.notes.trim() || undefined,
        }),
      })
      setForm({ amount: '', paid_on: new Date().toISOString().slice(0, 10), notes: '' })
      load()
      onRecorded?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record payment')
    } finally {
      setBusy(false)
    }
  }

  const total = rows.reduce((sum, p) => sum + Number(p.amount), 0)

  return (
    <Modal
      open={open}
      title={loanLabel ? `Payments — ${loanLabel}` : 'Loan payments'}
      onClose={onClose}
      size="wide"
      footer={
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      }
    >
      {canRecord && (
        <form className="card" style={{ marginBottom: '1rem' }} onSubmit={onSubmit}>
          <h3 className="section-title">Record payment</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Amount</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Paid on</label>
              <input
                type="date"
                value={form.paid_on}
                onChange={(e) => setForm({ ...form, paid_on: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
            Record payment
          </button>
        </form>
      )}

      {loading && <p style={{ color: 'var(--muted)' }}>Loading payments…</p>}
      {error && <p className="error-msg">{error}</p>}
      {!loading && !error && rows.length === 0 && (
        <p style={{ color: 'var(--muted)' }}>No payments recorded yet for this loan.</p>
      )}
      {!loading && !error && rows.length > 0 && (
        <>
          <p className="loan-payments-total">
            Total paid: <strong>{money(total)}</strong>
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Notes</th>
                  <th>Recorded</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>{p.paid_on}</td>
                    <td>{money(p.amount)}</td>
                    <td>{p.notes ?? '—'}</td>
                    <td>{new Date(p.created_at.replace(' ', 'T')).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  )
}