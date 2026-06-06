import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { hasPermission } from '../../lib/auth'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import type { Branch, Department, Employee, Position } from '../../types/hrms'

const emptyForm = () => ({
  branch_id: '',
  department_id: '',
  position_id: '',
  emp_number: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  hire_date: new Date().toISOString().slice(0, 10),
  status: 'active',
})

export function EmployeeListPage() {
  const { user } = useAuth()
  const canManage = hasPermission(user, 'employees.manage')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())

  const loadDepts = async (branchId: string) => {
    if (!branchId) return setDepartments([])
    setDepartments(await api<Department[]>(`/departments?branch_id=${branchId}`))
  }

  const loadPositions = async (branchId: string) => {
    if (!branchId) return setPositions([])
    setPositions(await api<Position[]>(`/positions?branch_id=${branchId}`))
  }

  const load = async () => {
    setLoading(true)
    try {
      const [emps, br] = await Promise.all([
        api<Employee[]>('/employees'),
        api<Branch[]>('/branches'),
      ])
      setEmployees(emps)
      setBranches(br)
      if (br[0] && !form.branch_id) {
        setForm((f) => ({ ...f, branch_id: br[0].id }))
        await loadDepts(br[0].id)
        await loadPositions(br[0].id)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditingId('new')
    setForm({ ...emptyForm(), branch_id: branches[0]?.id ?? '' })
  }

  const openEdit = async (emp: Employee) => {
    setEditingId(emp.id)
    await loadDepts(emp.branch_id)
    await loadPositions(emp.branch_id)
    setForm({
      branch_id: emp.branch_id,
      department_id: emp.department_id ?? '',
      position_id: emp.position_id ?? '',
      emp_number: emp.emp_number,
      first_name: emp.first_name,
      last_name: emp.last_name,
      email: emp.email ?? '',
      phone: emp.phone ?? '',
      hire_date: emp.hire_date?.slice(0, 10) ?? '',
      status: emp.status,
    })
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const payload = {
      ...form,
      department_id: form.department_id || null,
      position_id: form.position_id || null,
    }
    if (editingId === 'new') {
      await api('/employees', { method: 'POST', body: JSON.stringify(payload) })
    } else if (editingId) {
      await api(`/employees/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) })
    }
    setEditingId(null)
    load()
  }

  const onTerminate = async (id: string) => {
    if (!confirm('Mark this employee as terminated?')) return
    await api(`/employees/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Staff directory and assignments"
        actions={
          canManage ? (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              Add employee
            </button>
          ) : undefined
        }
      />

      {editingId && canManage && (
        <form className="card" style={{ marginBottom: '1.5rem' }} onSubmit={onSubmit}>
          <h3 style={{ marginBottom: '1rem' }}>{editingId === 'new' ? 'New employee' : 'Edit employee'}</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Employee #</label>
              <input value={form.emp_number} onChange={(e) => setForm({ ...form, emp_number: e.target.value })} required disabled={editingId !== 'new'} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">active</option>
                <option value="on_leave">on_leave</option>
                <option value="resigned">resigned</option>
                <option value="terminated">terminated</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Branch</label>
            <select
              value={form.branch_id}
              onChange={async (e) => {
                const bid = e.target.value
                setForm({ ...form, branch_id: bid, department_id: '', position_id: '' })
                await loadDepts(bid)
                await loadPositions(bid)
              }}
              required
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Department</label>
              <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Position</label>
              <select value={form.position_id} onChange={(e) => setForm({ ...form, position_id: e.target.value })}>
                <option value="">—</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>First name</label>
              <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Last name</label>
              <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary">Save</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card table-wrap">
        {loading ? (
          <LoadingBlock />
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Branch</th>
                <th>Department</th>
                <th>Position</th>
                <th>Status</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td>{e.emp_number}</td>
                  <td>{e.first_name} {e.last_name}</td>
                  <td>{e.branch_name}</td>
                  <td>{e.department_name ?? '—'}</td>
                  <td>{e.position_title ?? '—'}</td>
                  <td><span className={`badge badge-${e.status}`}>{e.status}</span></td>
                  {canManage && (
                    <td>
                      <button type="button" className="btn btn-ghost" onClick={() => openEdit(e)}>Edit</button>
                      {e.status === 'active' && (
                        <button type="button" className="btn btn-ghost" style={{ marginLeft: 4 }} onClick={() => onTerminate(e.id)}>Terminate</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
