import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Modal } from './Modal'
import { TimePicker } from './TimePicker'

export type ShiftTemplateRecord = {
  id: string
  branch_id: string
  name: string
  start_time: string
  end_time: string
  break_mins?: number | string
  color_hex?: string | null
  branch_name?: string
}

type BranchOption = { id: string; name: string }

type Props = {
  open: boolean
  editing: ShiftTemplateRecord | null
  branches: BranchOption[]
  onClose: () => void
  onSaved: () => void
}

function toTimeInput(value: string): string {
  return value?.slice(0, 5) || '09:00'
}

const defaultForm = (branchId: string) => ({
  branch_id: branchId,
  name: '',
  start_time: '09:00',
  end_time: '17:00',
  break_mins: '60',
  color_hex: '#378ADD',
})

export function ShiftTemplateModal({ open, editing, branches, onClose, onSaved }: Props) {
  const [form, setForm] = useState(defaultForm(branches[0]?.id ?? ''))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm({
        branch_id: editing.branch_id,
        name: editing.name,
        start_time: toTimeInput(editing.start_time),
        end_time: toTimeInput(editing.end_time),
        break_mins: String(editing.break_mins ?? 0),
        color_hex: editing.color_hex || '#378ADD',
      })
    } else {
      setForm(defaultForm(branches[0]?.id ?? ''))
    }
    setError(null)
  }, [open, editing, branches])

  const save = async () => {
    setError(null)
    if (!form.name.trim() || !form.branch_id) {
      setError('Branch and name are required')
      return
    }

    const body = {
      branch_id: form.branch_id,
      name: form.name.trim(),
      start_time: form.start_time,
      end_time: form.end_time,
      break_mins: Number(form.break_mins) || 0,
      color_hex: form.color_hex || null,
    }

    setSaving(true)
    try {
      if (editing) {
        await api(`/shifts/templates/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await api('/shifts/templates', { method: 'POST', body: JSON.stringify(body) })
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save shift template')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      title={editing ? `Edit shift — ${editing.name}` : 'Add shift template'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add template'}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: '0.75rem' }}>
        <label className="geofence-field">
          <span>Branch</span>
          <select
            value={form.branch_id}
            onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
            required
          >
            <option value="">Select branch…</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="geofence-field">
          <span>Shift name</span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Opening, Closing, Mid"
            required
          />
        </label>
        <div className="form-row">
          <TimePicker
            label="Start time"
            value={form.start_time}
            onChange={(v) => setForm({ ...form, start_time: v })}
          />
          <TimePicker
            label="End time"
            value={form.end_time}
            onChange={(v) => setForm({ ...form, end_time: v })}
          />
        </div>
        <label className="geofence-field">
          <span>Break (minutes)</span>
          <input
            type="number"
            min={0}
            step={15}
            value={form.break_mins}
            onChange={(e) => setForm({ ...form, break_mins: e.target.value })}
          />
        </label>
        <label className="geofence-field">
          <span>Color</span>
          <input
            type="color"
            value={form.color_hex}
            onChange={(e) => setForm({ ...form, color_hex: e.target.value })}
          />
        </label>
      </div>
      {error && <p className="geofence-error">{error}</p>}
    </Modal>
  )
}
