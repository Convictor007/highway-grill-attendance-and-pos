import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { type LoadOptions, resolveLoadBehavior } from '../../lib/scroll'
import { useAuth } from '../../context/AuthContext'
import { useNotification } from '../../hooks/useNotification'
import { hasPermission } from '../../lib/auth'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmployeeAvatar } from '../../components/EmployeeAvatar'
import { DatePicker } from '../../components/DatePicker'
import { AddressField } from '../../components/AddressField'
import { NationalityField, DEFAULT_NATIONALITY } from '../../components/NationalityField'
import type { Branch, Department, Employee, Gender, Position } from '../../types/hrms'

type ViewMode = 'card' | 'list' | 'grid'

const VIEW_KEY = 'hg_employee_view_v2'

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
  employment_type: 'full_time',
  date_of_birth: '',
  gender: '' as Gender | '',
  nationality: DEFAULT_NATIONALITY,
  address: '',
  emergency_name: '',
  emergency_phone: '',
  pay_basis: 'hourly' as 'hourly' | 'daily',
  pay_rate: '',
  is_stay_in: false,
  housing_deduction: '',
})

function EmployeeActions({
  emp,
  canManage,
  onEdit,
  onTerminate,
}: {
  emp: Employee
  canManage: boolean
  onEdit: () => void
  onTerminate: () => void
}) {
  if (!canManage) return null
  return (
    <div className="employee-item-actions">
      <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>Edit</button>
      {emp.status === 'active' && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onTerminate}>Terminate</button>
      )}
    </div>
  )
}

export function EmployeeListPage() {
  const { user } = useAuth()
  const { success, error: notifyError, confirm } = useNotification()
  const canManage = hasPermission(user, 'employees.manage')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [view, setView] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(VIEW_KEY) as ViewMode | null
    if (saved === 'list' || saved === 'grid' || saved === 'card') return saved
    return 'card'
  })

  const setViewMode = (mode: ViewMode) => {
    setView(mode)
    localStorage.setItem(VIEW_KEY, mode)
  }

  const loadDepts = async (branchId: string) => {
    if (!branchId) return setDepartments([])
    setDepartments(await api<Department[]>(`/departments?branch_id=${branchId}`))
  }

  const loadPositions = async (branchId: string) => {
    if (!branchId) return setPositions([])
    setPositions(await api<Position[]>(`/positions?branch_id=${branchId}`))
  }

  const load = async (options?: LoadOptions) => {
    const { showLoading, finish } = resolveLoadBehavior(options)
    if (showLoading) setLoading(true)
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
      finish()
    }
  }

  useEffect(() => {
    load()
  }, [])

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
      employment_type: emp.employment_type ?? 'full_time',
      date_of_birth: emp.date_of_birth?.slice(0, 10) ?? '',
      gender: (emp.gender as Gender) ?? '',
      nationality: emp.nationality || DEFAULT_NATIONALITY,
      address: emp.address ?? '',
      emergency_name: emp.emergency_name ?? '',
      emergency_phone: emp.emergency_phone ?? '',
      pay_basis: emp.pay_basis === 'daily' ? 'daily' : 'hourly',
      pay_rate: emp.pay_rate != null && emp.pay_rate !== '' ? String(emp.pay_rate) : '',
      is_stay_in: Boolean(emp.is_stay_in),
      housing_deduction:
        emp.housing_deduction != null && emp.housing_deduction !== '' ? String(emp.housing_deduction) : '',
    })
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const payload = {
      ...form,
      department_id: form.department_id || null,
      position_id: form.position_id || null,
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      nationality: form.nationality || DEFAULT_NATIONALITY,
      address: form.address || null,
      emergency_name: form.emergency_name || null,
      emergency_phone: form.emergency_phone || null,
      pay_basis: form.pay_basis,
      pay_rate: form.pay_rate !== '' ? Number(form.pay_rate) : null,
      is_stay_in: form.is_stay_in,
      housing_deduction: form.is_stay_in && form.housing_deduction !== '' ? Number(form.housing_deduction) : 0,
    }
    try {
      if (editingId === 'new') {
        await api('/employees', { method: 'POST', body: JSON.stringify(payload) })
        success('Employee created')
      } else if (editingId) {
        await api(`/employees/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) })
        success('Employee updated')
      }
      setEditingId(null)
      load({ silent: true })
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not save employee')
    }
  }

  const onTerminate = async (id: string) => {
    if (!(await confirm('Mark this employee as terminated?', { variant: 'danger', confirmLabel: 'Terminate' }))) return
    try {
      await api(`/employees/${id}`, { method: 'DELETE' })
      success('Employee marked as terminated')
      load({ silent: true })
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not terminate employee')
    }
  }

  const viewToggle = (
    <div className="view-toggle" role="group" aria-label="Employee view">
      {(['card', 'list', 'grid'] as ViewMode[]).map((mode) => (
        <button
          key={mode}
          type="button"
          className={`btn btn-sm ${view === mode ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setViewMode(mode)}
        >
          {mode === 'card' ? 'Cards' : mode === 'list' ? 'List' : 'Grid'}
        </button>
      ))}
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Self-registration on login page · approve under Users"
        actions={viewToggle}
      />

      {editingId && canManage && (
        <form className="card employee-edit-panel" onSubmit={onSubmit}>
          <h3 className="section-title">{editingId === 'new' ? 'New employee' : 'Edit employee'}</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Employee #</label>
              <input value={form.emp_number} onChange={(e) => setForm({ ...form, emp_number: e.target.value })} required disabled={editingId !== 'new'} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="pending">pending</option>
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
          <div className="form-row">
            <DatePicker
              label="Birthday"
              value={form.date_of_birth}
              onChange={(date_of_birth) => setForm({ ...form, date_of_birth })}
              max={new Date().toISOString().slice(0, 10)}
            />
            <div className="form-group">
              <label>Gender</label>
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as Gender | '' })}>
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not">Prefer not to say</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <NationalityField value={form.nationality} onChange={(nationality) => setForm({ ...form, nationality })} />
            <DatePicker
              label="Date hired"
              value={form.hire_date}
              onChange={(hire_date) => setForm({ ...form, hire_date })}
              max={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
          <AddressField value={form.address} onChange={(address) => setForm({ ...form, address })} compact />
          <div className="form-row">
            <div className="form-group">
              <label>Emergency contact</label>
              <input value={form.emergency_name} onChange={(e) => setForm({ ...form, emergency_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Emergency phone</label>
              <input value={form.emergency_phone} onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Employment type</label>
            <select value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value })}>
              <option value="full_time">Full time</option>
              <option value="part_time">Part time</option>
              <option value="casual">Casual</option>
              <option value="seasonal">Seasonal</option>
            </select>
          </div>
          <fieldset className="form-fieldset">
            <legend>Payroll compensation</legend>
            <p className="form-hint" style={{ marginTop: 0 }}>
              Used when generating payslips. SSS, PhilHealth, Pag-IBIG, and tax are computed automatically from gross pay
              (Philippine rules) — you do not enter those per employee.
            </p>
            <div className="form-row">
              <div className="form-group">
                <label>Pay basis</label>
                <select
                  value={form.pay_basis}
                  onChange={(e) => setForm({ ...form, pay_basis: e.target.value as 'hourly' | 'daily' })}
                >
                  <option value="hourly">Hourly (hours × rate)</option>
                  <option value="daily">Daily (days worked × rate)</option>
                </select>
              </div>
              <div className="form-group">
                <label>{form.pay_basis === 'daily' ? 'Daily rate (₱)' : 'Hourly rate (₱)'}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Optional pay rate override"
                  value={form.pay_rate}
                  onChange={(e) => setForm({ ...form, pay_rate: e.target.value })}
                />
              </div>
            </div>
          </fieldset>
          <fieldset className="form-fieldset">
            <legend>Stay-in housing</legend>
            <p className="form-hint" style={{ marginTop: 0 }}>
              Deducted each payroll run and shown on the payslip as <strong>HSNG</strong>.
            </p>
            <label className="checkbox-row" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
              <input
                type="checkbox"
                checked={form.is_stay_in}
                onChange={(e) => setForm({ ...form, is_stay_in: e.target.checked, housing_deduction: e.target.checked ? form.housing_deduction : '' })}
              />
              <span>Employee uses company stay-in housing</span>
            </label>
            {form.is_stay_in && (
              <div className="form-group">
                <label>Housing deduction per month (₱)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 1000 — half per semi-monthly run"
                  value={form.housing_deduction}
                  onChange={(e) => setForm({ ...form, housing_deduction: e.target.value })}
                />
              </div>
            )}
          </fieldset>
          <div className="quick-actions">
            <button type="submit" className="btn btn-primary">Save</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <LoadingBlock />
      ) : view === 'card' ? (
        <div className="employee-cards">
          {employees.map((e) => (
            <article key={e.id} className="employee-card card">
              <div className="employee-card__top">
                <EmployeeAvatar photoUrl={e.photo_url} firstName={e.first_name} lastName={e.last_name} size={52} />
                <div>
                  <strong>{e.first_name} {e.last_name}</strong>
                  <p className="muted-block employee-card__sub">{e.emp_number}</p>
                </div>
                <span className={`badge badge-${e.status}`}>{e.status}</span>
              </div>
              <dl className="employee-card__meta">
                <div><dt>Branch</dt><dd>{e.branch_name}</dd></div>
                <div><dt>Dept</dt><dd>{e.department_name ?? '—'}</dd></div>
                <div><dt>Role</dt><dd>{e.position_title ?? '—'}</dd></div>
                <div><dt>Phone</dt><dd>{e.phone ?? '—'}</dd></div>
              </dl>
              <EmployeeActions
                emp={e}
                canManage={canManage}
                onEdit={() => openEdit(e)}
                onTerminate={() => onTerminate(e.id)}
              />
            </article>
          ))}
        </div>
      ) : view === 'list' ? (
        <div className="employee-list card">
          {employees.map((e) => (
            <div key={e.id} className="employee-list-row">
              <EmployeeAvatar photoUrl={e.photo_url} firstName={e.first_name} lastName={e.last_name} size={40} />
              <div className="employee-list-row__main">
                <strong>{e.first_name} {e.last_name}</strong>
                <span className="muted-block">{e.emp_number} · {e.position_title ?? '—'} · {e.branch_name}</span>
              </div>
              <span className={`badge badge-${e.status}`}>{e.status}</span>
              <EmployeeActions
                emp={e}
                canManage={canManage}
                onEdit={() => openEdit(e)}
                onTerminate={() => onTerminate(e.id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="employee-grid">
          {employees.map((e) => (
            <button
              key={e.id}
              type="button"
              className="employee-grid-tile card"
              onClick={() => canManage && openEdit(e)}
              disabled={!canManage}
            >
              <EmployeeAvatar photoUrl={e.photo_url} firstName={e.first_name} lastName={e.last_name} size={56} />
              <strong>{e.first_name}</strong>
              <span className="muted-block">{e.last_name}</span>
              <span className={`badge badge-${e.status}`}>{e.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
