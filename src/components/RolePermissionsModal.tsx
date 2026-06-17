import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { RolePermissionsEditor, saveRolePermissions } from './RolePermissionsEditor'
import type { Role } from '../types/hrms'

type Props = {
  open: boolean
  role: Role | null
  onClose: () => void
  onSaved?: () => void
}

export function RolePermissionsModal({ open, role, onClose, onSaved }: Props) {
  const [permissionIds, setPermissionIds] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setPermissionIds(new Set())
      setError(null)
    }
  }, [open])

  const save = async () => {
    if (!role || role.role_type === 'system') return
    setSaving(true)
    setError(null)
    try {
      await saveRolePermissions(role.role_slug, [...permissionIds])
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save permissions')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={role ? `Permissions — ${role.role_name}` : 'Role permissions'}
      onClose={onClose}
      size="wide"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          {role?.role_type !== 'system' && (
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save permissions'}
            </button>
          )}
        </>
      }
    >
      {error && <p className="error-msg">{error}</p>}
      <RolePermissionsEditor role={role} value={permissionIds} onChange={setPermissionIds} />
    </Modal>
  )
}
