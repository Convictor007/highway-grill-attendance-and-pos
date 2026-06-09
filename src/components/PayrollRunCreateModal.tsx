import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { useNotification } from '../hooks/useNotification'
import { Spinner } from './Spinner'
import { currentSemiMonthly, cutoffLabel, nextSemiMonthly } from '../lib/payrollPeriod'
import type { Branch, PayrollRun } from '../types/hrms'
import { DatePicker } from './DatePicker'
import { Modal } from './Modal'

type Props = {
  open: boolean
  branches: Branch[]
  onClose: () => void
  onCreated: (run: PayrollRun) => void
}

type RunForm = {
  branch_id: string
  period_start: string
  period_end: string
  pay_date: string
}

function semiMonthlyFields(which: 'current' | 'next'): Pick<RunForm, 'period_start' | 'period_end' | 'pay_date'> {
  const p = which === 'next' ? nextSemiMonthly() : currentSemiMonthly()
  return {
    period_start: p.period_start,
    period_end: p.period_end,
    pay_date: p.pay_date,
  }
}

export function PayrollRunCreateModal({ open, branches, onClose, onCreated }: Props) {
  const { success, error: notifyError } = useNotification()
  const [form, setForm] = useState<RunForm>({
    branch_id: '',
    period_start: '',
    period_end: '',
    pay_date: '',
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({
      branch_id: branches[0]?.id ?? '',
      ...semiMonthlyFields('current'),
    })
  }, [open, branches])

  const applyCutoff = (which: 'current' | 'next') => {
    setForm((f) => ({ ...f, ...semiMonthlyFields(which) }))
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const run = await api<PayrollRun>('/payroll/runs', {
        method: 'POST',
        body: JSON.stringify({ ...form, pay_frequency: 'semi_monthly' }),
      })
      success('Payroll run created')
      onCreated(run)
      onClose()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not create payroll run')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title="New semi-monthly run"
      onClose={onClose}
      closeOnBackdropClick={!busy}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="payroll-run-create-form" className="btn btn-primary" disabled={busy}>
            {busy ? (
              <>
                <Spinner size="sm" />
                Creating…
              </>
            ) : (
              'Create run'
            )}
          </button>
        </>
      }
    >
      <form id="payroll-run-create-form" onSubmit={onSubmit}>
        <div className="form-row" style={{ marginBottom: '1rem', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => applyCutoff('current')}>
            This cutoff ({cutoffLabel(currentSemiMonthly().cutoff)})
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => applyCutoff('next')}>
            Next cutoff ({cutoffLabel(nextSemiMonthly().cutoff)})
          </button>
        </div>

        <div className="form-group">
          <label>Branch</label>
          <select
            value={form.branch_id}
            onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
            required
          >
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
      </form>
    </Modal>
  )
}
