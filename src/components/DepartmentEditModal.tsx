import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Modal } from './Modal'

export type DepartmentEditInput = {
  id: string
  branch_id: string
  name: string
  cost_center?: string | null
  branch_name?: string
}

type BranchOption = { id: string; name: string }

type Props = {
  open: boolean
  department: DepartmentEditInput | null
  branches: BranchOption[]
  onClose: () => void
  onSaved: () => void
}

export function DepartmentEditModal({ open, department, branches, onClose, onSaved }: Props) {
  const [branchId, setBranchId] = useState('')
  const [name, setName] = useState('')
  const [costCenter, setCostCenter] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !department) return
    setBranchId(department.branch_id)
    setName(department.name)
    setCostCenter(department.cost_center ?? '')
    setError(null)
  }, [open, department])

  const save = async () => {
    if (!department) return
    setError(null)
    if (!name.trim()) {
      setError('Department name is required')
      return
    }
    if (!branchId) {
      setError('Select a branch')
      return
    }

    setSaving(true)
    try {
      await api(`/settings/departments/${department.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          branch_id: branchId,
          name: name.trim(),
          cost_center: costCenter.trim() || null,
        }),
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save department')
    } finally {
      setSaving(false)
    }
  }

  if (!open || !department) return null

  return (
    <Modal
      open={open}
      title={`Edit department — ${department.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save department'}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: '0.75rem' }}>
        <label className="geofence-field">
          <span>Branch</span>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
            <option value="">Select branch…</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="geofence-field">
          <span>Department name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="geofence-field">
          <span>Cost center (optional)</span>
          <input
            type="text"
            value={costCenter}
            onChange={(e) => setCostCenter(e.target.value)}
            placeholder="e.g. KITCHEN-01"
          />
        </label>
      </div>
      {error && <p className="geofence-error">{error}</p>}
    </Modal>
  )
}
