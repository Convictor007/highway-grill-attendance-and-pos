import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '../Modal'
import type { BenefitEnrollment } from '../../types/hrms'

type Props = {
  open: boolean
  employeeId: string
  employeeName?: string
  editing?: BenefitEnrollment | null
  saving?: boolean
  onClose: () => void
  onSave: (payload: Record<string, unknown>) => Promise<void>
}

const emptyForm = () => ({
  benefit_name: '',
  benefit_code: 'allowance',
  amount: '',
  frequency: 'monthly',
  notes: '',
  is_active: true,
})

export function BenefitEnrollmentModal({
  open,
  employeeId,
  employeeName,
  editing,
  saving,
  onClose,
  onSave,
}: Props) {
  const [form, setForm] = useState(emptyForm())

  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm({
        benefit_name: editing.benefit_name,
        benefit_code: editing.benefit_code,
        amount: String(editing.amount),
        frequency: editing.frequency,
        notes: editing.notes ?? '',
        is_active: editing.is_active !== false && editing.is_active !== 0,
      })
    } else {
      setForm(emptyForm())
    }
  }, [open, editing])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await onSave({
      employee_id: employeeId,
      benefit_name: form.benefit_name.trim(),
      benefit_code: form.benefit_code,
      amount: Number(form.amount),
      frequency: form.frequency,
      notes: form.notes.trim() || null,
      ...(editing ? { is_active: form.is_active } : {}),
    })
  }

  return (
    <Modal
      open={open}
      title={editing ? 'Edit allowance' : `Add allowance${employeeName ? ` — ${employeeName}` : ''}`}
      onClose={onClose}
    >
      <form className="stack" onSubmit={onSubmit}>
        <div className="form-group">
          <label>Benefit name</label>
          <input
            value={form.benefit_name}
            onChange={(e) => setForm({ ...form, benefit_name: e.target.value })}
            placeholder="e.g. Meal allowance"
            required
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Code</label>
            <select value={form.benefit_code} onChange={(e) => setForm({ ...form, benefit_code: e.target.value })}>
              <option value="allowance">Allowance</option>
              <option value="meal">Meal</option>
              <option value="transport">Transport</option>
              <option value="rice">Rice</option>
            </select>
          </div>
          <div className="form-group">
            <label>Frequency</label>
            <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
              <option value="monthly">Monthly</option>
              <option value="per_payroll">Per payroll</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Amount (₱)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <label>Notes (optional)</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        </div>
        {editing && (
          <label className="geofence-field geofence-field--checkbox">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            <span>Active (included in payroll)</span>
          </label>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add allowance'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
