import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { RolePermissionsModal } from '../../components/RolePermissionsModal'
import type { AppUser, Employee, Role } from '../../types/hrms'

export function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
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
    const [u, e, r] = await Promise.all([
      api<AppUser[]>('/users'),
      api<Employee[]>('/employees'),
      api<Role[]>('/roles'),
    ])
    setUsers(u)
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

  return (
    <div>
      <PageHeader
        title="User accounts"
        subtitle="Logins must be linked to an employee for clock in/out to work"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add login'}
          </button>
        }
      />

      {showForm && (
        <form className="card" style={{ marginBottom: '1.5rem' }} onSubmit={onCreate}>
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
              <label>Link to employee (required for time clock)</label>
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
        <p className="muted-block" style={{ marginBottom: '0.75rem' }}>
          View what each role can access before assigning it to a user.
        </p>
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
              <th>Active</th>
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
                <td>
                  {editingId === u.id ? (
                    <select
                      value={editForm.is_active ? '1' : '0'}
                      onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.value === '1' }))}
                    >
                      <option value="1">Yes</option>
                      <option value="0">No</option>
                    </select>
                  ) : (
                    u.is_active ? 'Yes' : 'No'
                  )}
                </td>
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
