import { useEffect, useState, type FormEvent } from 'react'
import type { GovernmentProfile } from '../../types/hrms'

type Props = {
  employeeId: string
  profile: GovernmentProfile | null
  saving?: boolean
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

export function GovernmentProfileForm({ employeeId, profile, saving, onSave }: Props) {
  const [form, setForm] = useState(emptyForm())

  useEffect(() => {
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
  }, [employeeId, profile])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await onSave({
      employee_id: employeeId,
      ...form,
    })
  }

  return (
    <form className="card stack" onSubmit={onSubmit}>
      <div>
        <h3 className="section-title">Government IDs</h3>
        <p className="form-hint" style={{ marginTop: 0 }}>
          Member numbers and payroll deduction flags for this employee.
        </p>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>SSS number</label>
          <input
            value={form.sss_number}
            onChange={(e) => setForm({ ...form, sss_number: e.target.value })}
            placeholder="34-1234567-8"
          />
        </div>
        <label className="geofence-field geofence-field--checkbox">
          <input
            type="checkbox"
            checked={form.sss_enrolled}
            onChange={(e) => setForm({ ...form, sss_enrolled: e.target.checked })}
          />
          <span>Deduct SSS on payroll</span>
        </label>
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
        <label className="geofence-field geofence-field--checkbox">
          <input
            type="checkbox"
            checked={form.philhealth_enrolled}
            onChange={(e) => setForm({ ...form, philhealth_enrolled: e.target.checked })}
          />
          <span>Deduct PhilHealth on payroll</span>
        </label>
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
        <label className="geofence-field geofence-field--checkbox">
          <input
            type="checkbox"
            checked={form.pagibig_enrolled}
            onChange={(e) => setForm({ ...form, pagibig_enrolled: e.target.checked })}
          />
          <span>Deduct Pag-IBIG on payroll</span>
        </label>
      </div>

      <div className="form-group">
        <label>TIN (withholding tax)</label>
        <input value={form.tin} onChange={(e) => setForm({ ...form, tin: e.target.value })} placeholder="123-456-789-000" />
      </div>

      <div className="form-group">
        <label>Notes (optional)</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
      </div>

      <div className="quick-actions" style={{ margin: 0 }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
