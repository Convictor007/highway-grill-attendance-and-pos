import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Modal } from './Modal'

export type LeaveTypeRecord = {
  id: string
  name: string
  paid: number | boolean
  days_per_year: string | number
  carry_forward: number | boolean
  requires_approval: number | boolean
  color_hex: string | null
}

type Props = {
  open: boolean
  editing: LeaveTypeRecord | null
  onClose: () => void
  onSaved: () => void
}

const defaultForm = () => ({
  name: '',
  days_per_year: '0',
  paid: true,
  carry_forward: false,
  requires_approval: true,
  color_hex: '#378ADD',
})

function asBool(v: number | boolean | undefined): boolean {
  return v === true || v === 1
}

export function LeaveTypeModal({ open, editing, onClose, onSaved }: Props) {
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm({
        name: editing.name,
        days_per_year: String(editing.days_per_year ?? 0),
        paid: asBool(editing.paid),
        carry_forward: asBool(editing.carry_forward),
        requires_approval: asBool(editing.requires_approval),
        color_hex: editing.color_hex || '#378ADD',
      })
    } else {
      setForm(defaultForm())
    }
    setError(null)
  }, [open, editing])

  const save = async () => {
    setError(null)
    if (!form.name.trim()) {
      setError('Name is required')
      return
    }

    const body = {
      name: form.name.trim(),
      days_per_year: Number(form.days_per_year) || 0,
      paid: form.paid,
      carry_forward: form.carry_forward,
      requires_approval: form.requires_approval,
      color_hex: form.color_hex || '#378ADD',
    }

    setSaving(true)
    try {
      if (editing) {
        await api(`/leave/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await api('/leave/types', { method: 'POST', body: JSON.stringify(body) })
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save leave type')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      title={editing ? `Edit leave type — ${editing.name}` : 'Add leave type'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add type'}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: '0.75rem' }}>
        <label className="geofence-field">
          <span>Name</span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Vacation leave"
            required
          />
        </label>
        <label className="geofence-field">
          <span>Days per year</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={form.days_per_year}
            onChange={(e) => setForm({ ...form, days_per_year: e.target.value })}
          />
        </label>
        <label className="geofence-field">
          <span>Calendar color</span>
          <input
            type="color"
            value={form.color_hex}
            onChange={(e) => setForm({ ...form, color_hex: e.target.value })}
          />
        </label>
        <label className="geofence-field geofence-field--checkbox">
          <input
            type="checkbox"
            checked={form.paid}
            onChange={(e) => setForm({ ...form, paid: e.target.checked })}
          />
          <span>Paid leave</span>
        </label>
        <label className="geofence-field geofence-field--checkbox">
          <input
            type="checkbox"
            checked={form.carry_forward}
            onChange={(e) => setForm({ ...form, carry_forward: e.target.checked })}
          />
          <span>Allow carry forward</span>
        </label>
        <label className="geofence-field geofence-field--checkbox">
          <input
            type="checkbox"
            checked={form.requires_approval}
            onChange={(e) => setForm({ ...form, requires_approval: e.target.checked })}
          />
          <span>Requires manager approval</span>
        </label>
      </div>
      {error && <p className="geofence-error">{error}</p>}
    </Modal>
  )
}
