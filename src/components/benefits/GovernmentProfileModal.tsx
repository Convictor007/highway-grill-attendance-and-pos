import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '../Modal'
import type { GovernmentProfile } from '../../types/hrms'

type Props = {
  open: boolean
  employeeId: string
  profile: GovernmentProfile | null
  saving?: boolean
  onClose: () => void
  onSave: (payload: Record<string, unknown>) => Promise<void>
}

const emptyForm = () => ({
  sss_number: '',
  philhealth_number: '',
  pagibig_number: '',
  tin: '',
  sss_enrolled: true,
  philhealth_enrolled: true,
  pagibig_enrolled: true,
  notes: '',
})

export function GovernmentProfileModal({ open, employeeId, profile, saving, onClose, onSave }: Props) {
  const [form, setForm] = useState(emptyForm())

  useEffect(() => {
    if (!open) return
    setForm({
      sss_number: profile?.sss_number ?? '',
      philhealth_number: profile?.philhealth_number ?? '',
      pagibig_number: profile?.pagibig_number ?? '',
      tin: profile?.tin ?? '',
      sss_enrolled: profile?.sss_enrolled !== false,
      philhealth_enrolled: profile?.philhealth_enrolled !== false,
      pagibig_enrolled: profile?.pagibig_enrolled !== false,
      notes: profile?.notes ?? '',
    })
  }, [open, profile])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await onSave({
      employee_id: employeeId,
      ...form,
    })
  }

  return (
    <Modal open={open} title="Government benefit profile" onClose={onClose}>
      <form className="stack" onSubmit={onSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>SSS number</label>
            <input
              value={form.sss_number}
              onChange={(e) => setForm({ ...form, sss_number: e.target.value })}
              placeholder="34-1234567-8"
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={form.sss_enrolled}
                onChange={(e) => setForm({ ...form, sss_enrolled: e.target.checked })}
              />{' '}
              SSS enrolled
            </label>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>PhilHealth number</label>
            <input
              value={form.philhealth_number}
              onChange={(e) => setForm({ ...form, philhealth_number: e.target.value })}
              placeholder="12-345678901-2"
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={form.philhealth_enrolled}
                onChange={(e) => setForm({ ...form, philhealth_enrolled: e.target.checked })}
              />{' '}
              PhilHealth enrolled
            </label>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Pag-IBIG number</label>
            <input
              value={form.pagibig_number}
              onChange={(e) => setForm({ ...form, pagibig_number: e.target.value })}
              placeholder="1212-3456-7890"
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={form.pagibig_enrolled}
                onChange={(e) => setForm({ ...form, pagibig_enrolled: e.target.checked })}
              />{' '}
              Pag-IBIG enrolled
            </label>
          </div>
        </div>
        <div className="form-group">
          <label>TIN</label>
          <input value={form.tin} onChange={(e) => setForm({ ...form, tin: e.target.value })} placeholder="123-456-789-000" />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
