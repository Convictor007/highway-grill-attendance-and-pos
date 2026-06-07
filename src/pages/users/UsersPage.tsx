import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { RolePermissionsModal } from '../../components/RolePermissionsModal'
import type { AppUser, Employee, Role } from '../../types/hrms'

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

export function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [pending, setPending] = useState<AppUser[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [form, setForm] = useState({
    email: '',
    password: 'dsadsadsa',
    role_id: 0,
    employee_id: '',
  })
  const [editForm, setEditForm] = useState({
    role_id: 0,
    employee_id: '',
    is_active: true,
    password: '',
  })
  const [permissionsRole, setPermissionsRole] = useState<Role | null>(null)

  const load = async () => {
    const [u, p, e, r] = await Promise.all([
      api<AppUser[]>('/users'),
      api<AppUser[]>('/users/pending'),
      api<Employee[]>('/employees'),
      api<Role[]>('/roles'),
    ])
    setUsers(u)
    setPending(p)
    setEmployees(e.filter((x) => x.status === 'active'))
    setRoles(r)
    if (r[0] && !form.role_id) setForm((f) => ({ ...f, role_id: r[0].role_id }))
  }

  useEffect(() => {
    load()
  }, [])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    await api('/users', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        employee_id: form.employee_id || null,
        account_status: 'active',
      }),
    })
    setShowForm(false)
    load()
  }

  const startEdit = (u: AppUser) => {
    setEditingId(u.id)
    setEditForm({
      role_id: u.role_id ?? roles.find((r) => r.role_slug === u.role_slug)?.role_id ?? 0,
      employee_id: u.employee_id ?? '',
      is_active: Boolean(u.is_active),
      password: '',
    })
  }

  const onSaveEdit = async (id: string) => {
    await api(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        role_id: editForm.role_id,
        employee_id: editForm.employee_id || null,
        is_active: editForm.is_active,
        ...(editForm.password ? { password: editForm.password } : {}),
      }),
    })
    setEditingId(null)
    load()
  }

  const runAction = async (id: string, action: 'approve' | 'activate' | 'reject') => {
    setBusyId(id)
    try {
      if (action === 'reject') {
        const reason = window.prompt('Rejection reason (optional):') ?? undefined
        await api(`/users/${id}/reject`, {
          method: 'POST',
          body: JSON.stringify(reason ? { reason } : {}),
        })
      } else {
        await api(`/users/${id}/${action}`, { method: 'POST' })
      }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="User accounts"
        subtitle="Employees self-register; HR approves then activates for time clock and schedules"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add staff login'}
          </button>
        }
      />

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

      {showForm && (
        <form className="card" style={{ marginBottom: '1.5rem' }} onSubmit={onCreate}>
          <p className="muted-block" style={{ marginBottom: '1rem' }}>
            Use this only for admin/HR logins. Restaurant employees should use <strong>Register</strong> on the login page.
          </p>
          <div className="form-row">
            <div className="form-group">
              <label>Email (login)</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Role</label>
              <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })} required>
                {roles.map((r) => (
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

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="section-title">Roles & permissions</h3>
        <div className="role-permissions-actions">
          {roles.map((r) => (
            <button
              key={r.role_id}
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setPermissionsRole(r)}
            >
              {r.role_name}
            </button>
          ))}
        </div>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Employee</th>
              <th>Account</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>
                  {editingId === u.id ? (
                    <select
                      value={editForm.role_id}
                      onChange={(e) => setEditForm((f) => ({ ...f, role_id: Number(e.target.value) }))}
                    >
                      {roles.map((r) => (
                        <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
                      ))}
                    </select>
                  ) : (
                    u.role_name
                  )}
                </td>
                <td>
                  {editingId === u.id ? (
                    <select
                      value={editForm.employee_id}
                      onChange={(e) => setEditForm((f) => ({ ...f, employee_id: e.target.value }))}
                    >
                      <option value="">— None —</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.emp_number} — {emp.first_name} {emp.last_name}
                        </option>
                      ))}
                    </select>
                  ) : u.first_name ? (
                    `${u.first_name} ${u.last_name}`
                  ) : (
                    <span className="error-msg" style={{ margin: 0 }}>Not linked</span>
                  )}
                </td>
                <td>{statusLabel(u.account_status)}</td>
                <td>
                  {editingId === u.id ? (
                    <div className="quick-actions" style={{ margin: 0 }}>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => onSaveEdit(u.id)}>
                        Save
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(u)}>
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RolePermissionsModal
        open={permissionsRole != null}
        role={permissionsRole}
        onClose={() => setPermissionsRole(null)}
      />
    </div>
  )
}
