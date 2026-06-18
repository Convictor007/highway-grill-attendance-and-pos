import { useState } from 'react'
import { Modal } from './Modal'
import { UserAccountEditPanel, type UserAccountDraft } from './UserAccountEditPanel'
import type { AppUser, Employee, Role } from '../types/hrms'

const FORM_ID = 'user-account-edit-form'

type Props = {
  open: boolean
  user: AppUser | null
  roles: Role[]
  employees: Employee[]
  saving: boolean
  onClose: () => void
  onSave: (draft: UserAccountDraft, permissionIds: number[] | null) => Promise<void>
}

export function UserAccountEditModal({
  open,
  user,
  roles,
  employees,
  saving,
  onClose,
  onSave,
}: Props) {
  const [formReady, setFormReady] = useState(true)

  if (!user) return null

  const userKey = user.id

  return (
    <Modal
      open={open}
      title="Edit staff account"
      onClose={onClose}
      size="large"
      panelClassName="staff-edit-modal-panel"
      closeOnBackdropClick={false}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            form={FORM_ID}
            className="btn btn-primary"
            disabled={saving || !formReady}
          >
            {saving ? 'Saving…' : formReady ? 'Save changes' : 'Loading…'}
          </button>
        </>
      }
    >
      <UserAccountEditPanel
        key={userKey}
        formId={FORM_ID}
        inModal
        user={user}
        roles={roles}
        employees={employees}
        saving={saving}
        onSave={onSave}
        onReadyChange={setFormReady}
      />
    </Modal>
  )
}
