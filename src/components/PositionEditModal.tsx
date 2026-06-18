import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Modal } from './Modal'

export type PositionEditInput = {
  id: string
  department_id: string
  title: string
  pay_grade?: number | string | null
  min_hourly?: string | number | null
  max_hourly?: string | number | null
  is_tipped?: number | boolean
  department_name?: string
  branch_name?: string
}

type DepartmentOption = {
  id: string
  name: string
  branch_name?: string
}

type Props = {
  open: boolean
  position: PositionEditInput | null
  departments: DepartmentOption[]
  onClose: () => void
  onSaved: () => void
}

function asBool(v: number | boolean | undefined): boolean {
  return v === true || v === 1
}

const defaultForm = (departmentId: string) => ({
  department_id: departmentId,
  title: '',
  pay_grade: '',
  is_tipped: false,
})

export function PositionEditModal({ open, position, departments, onClose, onSaved }: Props) {
  const [form, setForm] = useState(defaultForm(departments[0]?.id ?? ''))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = position !== null

  useEffect(() => {
    if (!open) return
    if (position) {
      setForm({
        department_id: position.department_id,
        title: position.title,
        pay_grade: position.pay_grade != null ? String(position.pay_grade) : '',
        is_tipped: asBool(position.is_tipped),
      })
    } else {
      setForm(defaultForm(departments[0]?.id ?? ''))
    }
    setError(null)
  }, [open, position, departments])

  const save = async () => {
    setError(null)
    if (!form.title.trim() || !form.department_id) {
      setError('Department and title are required')
      return
    }

    const body = {
      department_id: form.department_id,
      title: form.title.trim(),
      pay_grade: form.pay_grade !== '' ? Number(form.pay_grade) : null,
      is_tipped: form.is_tipped,
    }

    setSaving(true)
    try {
      if (isEdit && position) {
        await api(`/settings/positions/${position.id}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await api('/settings/positions', { method: 'POST', body: JSON.stringify(body) })
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save position')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      title={isEdit ? `Edit position — ${position?.title}` : 'Add position'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add position'}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: '0.75rem' }}>
        <label className="geofence-field">
          <span>Department</span>
          <select
            value={form.department_id}
            onChange={(e) => setForm({ ...form, department_id: e.target.value })}
            required
          >
            <option value="">Select department…</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.branch_name ? `${d.branch_name} — ` : ''}
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="geofence-field">
          <span>Job title</span>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Line Cook, Cashier"
            required
          />
        </label>
        <label className="geofence-field">
          <span>Pay grade (optional)</span>
          <input
            type="number"
            min={1}
            value={form.pay_grade}
            onChange={(e) => setForm({ ...form, pay_grade: e.target.value })}
          />
        </label>
        <label className="geofence-field geofence-field--checkbox">
          <input
            type="checkbox"
            checked={form.is_tipped}
            onChange={(e) => setForm({ ...form, is_tipped: e.target.checked })}
          />
          <span>Tipped position</span>
        </label>
      </div>
      {error && <p className="geofence-error">{error}</p>}
    </Modal>
  )
}
