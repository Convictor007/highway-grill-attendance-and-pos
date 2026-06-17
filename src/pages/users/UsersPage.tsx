import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useNotification } from '../../hooks/useNotification'
import { hasPermission } from '../../lib/auth'
import { isManageableStaffRole } from '../../lib/roles'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState } from '../../components/EmptyState'
import { UserAccountEditModal } from '../../components/UserAccountEditModal'
import { saveRolePermissions } from '../../components/RolePermissionsEditor'
import type { UserAccountDraft } from '../../components/UserAccountEditPanel'
import type { AppUser, Employee, Role } from '../../types/hrms'

type Props = {
  /** System admin — full accounts, roles, and permissions */
  fullAdmin?: boolean
}

function statusLabel(status?: string): string {
  switch (status) {
    case 'awaiting_hr':
      return 'Awaiting HR'
    case 'pending':
      return 'Pending (can sign in)'
    case 'active':
      return 'Active'
    case 'rejected':
      return 'Rejected'
    default:
      return status ?? '—'
  }
}

export function UsersPage({ fullAdmin = false }: Props) {
  const { user } = useAuth()
  const { success, error: notifyError, prompt } = useNotification()
  const isFullAdmin = fullAdmin || hasPermission(user, 'users.manage')
  const [users, setUsers] = useState<AppUser[]>([])
  const [pending, setPending] = useState<AppUser[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [form, setForm] = useState({
    email: '',
    password: '',
    role_id: 0,
    employee_id: '',
  })

  const staffRoles = roles.filter((r) => isManageableStaffRole(r.role_slug))

  const load = async () => {
    const p = await api<AppUser[]>('/users/pending')
    setPending(p)
    if (!isFullAdmin) return

    const [u, e, r] = await Promise.all([
      api<AppUser[]>('/users'),
      api<Employee[]>('/employees'),
      api<Role[]>('/roles'),
    ])
    setUsers(u)
    setEmployees(e.filter((x) => x.status === 'active'))
    setRoles(r)
    const defaultRole = r.find((x) => x.role_slug === 'hr') ?? r.find((x) => x.role_slug !== 'admin')
    if (defaultRole && !form.role_id) setForm((f) => ({ ...f, role_id: defaultRole.role_id }))
  }

  useEffect(() => {
    load()
  }, [isFullAdmin])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          employee_id: form.employee_id || null,
          account_status: 'active',
        }),
      })
      success('User account created')
      setShowForm(false)
      load()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not create user')
    }
  }

  const onSaveUser = async (id: string, draft: UserAccountDraft, permissionIds: number[] | null) => {
    setSavingId(id)
    try {
      await api(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          email: draft.email,
          role_id: draft.role_id,
          employee_id: draft.employee_id || null,
          is_active: draft.is_active,
          account_status: draft.account_status,
          ...(draft.password ? { password: draft.password } : {}),
        }),
      })

      if (draft.employee_id) {
        await api(`/employees/${draft.employee_id}`, {
          method: 'PUT',
          body: JSON.stringify({
            first_name: draft.first_name,
            last_name: draft.last_name,
            emp_number: draft.emp_number,
            phone: draft.phone || null,
            email: draft.email,
            branch_id: draft.branch_id || null,
            department_id: draft.department_id || null,
            position_id: draft.position_id || null,
            date_of_birth: draft.date_of_birth || null,
            gender: draft.gender || null,
            nationality: draft.nationality || null,
            national_id: draft.national_id || null,
            address: draft.address || null,
            emergency_name: draft.emergency_name || null,
            emergency_phone: draft.emergency_phone || null,
          }),
        })
      }

      if (permissionIds) {
        const role = roles.find((r) => r.role_id === draft.role_id)
        if (role) await saveRolePermissions(role.role_slug, permissionIds)
      }

      success('Staff account updated')
      setEditingUser(null)
      await load()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not update user')
    } finally {
      setSavingId(null)
    }
  }

  const runAction = async (id: string, action: 'approve' | 'activate' | 'reject') => {
    setBusyId(id)
    try {
      if (action === 'reject') {
        const reason = await prompt('Rejection reason (optional):', {
          title: 'Reject registration',
          label: 'Reason',
          placeholder: 'Optional note for the applicant',
        })
        if (reason === null) return
        await api(`/users/${id}/reject`, {
          method: 'POST',
          body: JSON.stringify(reason ? { reason } : {}),
        })
        success('Registration rejected')
      } else {
        await api(`/users/${id}/${action}`, { method: 'POST' })
        success(action === 'approve' ? 'Applicant approved' : 'Employee activated')
      }
      await load()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title={isFullAdmin ? 'Staff logins' : 'Crew approvals'}
        subtitle={
          isFullAdmin
            ? 'Manage HR and crew accounts, roles, and permissions. Your system admin login is not shown here.'
            : 'Review self-registrations — approve sign-in, then activate for time clock and schedules'
        }
        actions={
          isFullAdmin ? (
            <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : 'Add staff login'}
            </button>
          ) : undefined
        }
      />

      {!isFullAdmin && pending.length === 0 && (
        <EmptyState title="No pending registrations" description="New crew sign-ups will appear here for approval." />
      )}

      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 className="section-title">Pending registrations</h3>
          <p className="muted-block" style={{ marginBottom: '1rem' }}>
            <strong>Approve</strong> lets the applicant sign in (pending). <strong>Activate</strong> enables time in/out,
            schedules, loans, and payroll. You can approve and activate in one step by clicking Activate on a new applicant.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Emp #</th>
                  <th>Position</th>
                  <th>Stay-in</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((u) => (
                  <tr key={u.id}>
                    <td>{u.first_name} {u.last_name}</td>
                    <td>{u.email}</td>
                    <td>{u.emp_number ?? '—'}</td>
                    <td>{u.position_title ?? '—'}</td>
                    <td>{u.is_stay_in ? 'Yes' : '—'}</td>
                    <td>{statusLabel(u.account_status)}</td>
                    <td>
                      <div className="quick-actions" style={{ margin: 0 }}>
                        {u.account_status === 'awaiting_hr' && (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={busyId === u.id}
                              onClick={() => runAction(u.id, 'approve')}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={busyId === u.id}
                              onClick={() => runAction(u.id, 'activate')}
                            >
                              Approve & activate
                            </button>
                          </>
                        )}
                        {u.account_status === 'pending' && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={busyId === u.id}
                            onClick={() => runAction(u.id, 'activate')}
                          >
                            Activate
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busyId === u.id}
                          onClick={() => runAction(u.id, 'reject')}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isFullAdmin && showForm && (
        <form className="card" style={{ marginBottom: '1.5rem' }} onSubmit={onCreate}>
          <p className="muted-block" style={{ marginBottom: '1rem' }}>
            Create HR or other staff logins here. Restaurant crew should use <strong>Register</strong> on the login page.
            System admin accounts cannot be created from this screen.
          </p>
          <div className="form-row">
            <div className="form-group">
              <label>Email (login)</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Role</label>
              <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })} required>
                {staffRoles.map((r) => (
                  <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Link to employee</label>
              <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                <option value="">— None —</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.emp_number} — {emp.first_name} {emp.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary">Create account</button>
        </form>
      )}

      {isFullAdmin && users.length === 0 && (
        <EmptyState
          title="No staff logins yet"
          description="Add an HR login or wait for crew to self-register. The system admin account is managed separately."
        />
      )}

      {isFullAdmin && users.length > 0 && (
      <div className="card table-wrap user-accounts-table">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Position</th>
              <th>Employee</th>
              <th>Account</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.role_name}</td>
                <td>{u.position_title ?? '—'}</td>
                <td>
                  {u.first_name ? (
                    `${u.first_name} ${u.last_name}`
                  ) : (
                    <span className="error-msg" style={{ margin: 0 }}>Not linked</span>
                  )}
                </td>
                <td>{statusLabel(u.account_status)}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setEditingUser(u)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {isFullAdmin && (
      <UserAccountEditModal
        open={editingUser != null}
        user={editingUser}
        roles={staffRoles}
        employees={employees}
        saving={editingUser != null && savingId === editingUser.id}
        onClose={() => setEditingUser(null)}
        onSave={async (draft, permissionIds) => {
          if (editingUser) await onSaveUser(editingUser.id, draft, permissionIds)
        }}
      />
      )}
    </div>
  )
}
