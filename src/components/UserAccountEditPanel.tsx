import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { ageFromDateOfBirth } from '../lib/age'
import { toDateInputValue } from '../lib/date'
import { RolePermissionsEditor } from './RolePermissionsEditor'
import { DatePicker } from './DatePicker'
import type { AppUser, Branch, Department, Employee, Gender, Position, Role } from '../types/hrms'

export type UserAccountDraft = {
  email: string
  password: string
  role_id: number
  employee_id: string
  is_active: boolean
  account_status: string
  first_name: string
  last_name: string
  emp_number: string
  phone: string
  date_of_birth: string
  gender: Gender | ''
  nationality: string
  national_id: string
  address: string
  emergency_name: string
  emergency_phone: string
  branch_id: string
  department_id: string
  position_id: string
  hire_date: string
  is_stay_in: boolean
  housing_deduction: string
}

type Tab = 'profile' | 'position' | 'permissions'

type Props = {
  user: AppUser
  roles: Role[]
  employees: Employee[]
  saving: boolean
  onSave: (draft: UserAccountDraft, permissionIds: number[] | null) => Promise<void>
  inModal?: boolean
  formId?: string
  onReadyChange?: (ready: boolean) => void
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'position', label: 'Position' },
  { id: 'permissions', label: 'Permissions' },
]

function draftFromUser(user: AppUser, roles: Role[]): UserAccountDraft {
  return {
    email: user.email ?? '',
    password: '',
    role_id: user.role_id ?? roles.find((r) => r.role_slug === user.role_slug)?.role_id ?? 0,
    employee_id: user.employee_id != null ? String(user.employee_id) : '',
    is_active: Boolean(user.is_active),
    account_status: user.account_status ?? 'active',
    first_name: user.first_name ?? '',
    last_name: user.last_name ?? '',
    emp_number: user.emp_number ?? '',
    phone: user.phone ?? '',
    date_of_birth: toDateInputValue(user.date_of_birth),
    gender: (user.gender as Gender) ?? '',
    nationality: user.nationality ?? '',
    national_id: user.national_id ?? '',
    address: user.address ?? '',
    emergency_name: user.emergency_name ?? '',
    emergency_phone: user.emergency_phone ?? '',
    branch_id: user.branch_id ?? '',
    department_id: user.department_id ?? '',
    position_id: user.position_id ?? '',
    hire_date: toDateInputValue(user.hire_date) || new Date().toISOString().slice(0, 10),
    is_stay_in: Boolean(user.is_stay_in),
    housing_deduction:
      user.housing_deduction != null && user.housing_deduction !== '' ? String(user.housing_deduction) : '',
  }
}

function displayName(draft: UserAccountDraft, user: AppUser): string {
  const name = `${draft.first_name} ${draft.last_name}`.trim()
  if (name) return name
  return user.email ?? 'Staff account'
}

function initials(draft: UserAccountDraft, user: AppUser): string {
  const a = draft.first_name?.[0] ?? user.email?.[0] ?? '?'
  const b = draft.last_name?.[0] ?? ''
  return `${a}${b}`.toUpperCase()
}

function mergeEmployeeIntoDraft(base: UserAccountDraft, emp: Employee): UserAccountDraft {
  return {
    ...base,
    employee_id: String(emp.id),
    first_name: emp.first_name ?? '',
    last_name: emp.last_name ?? '',
    emp_number: emp.emp_number ?? '',
    phone: emp.phone ?? '',
    email: emp.email ?? base.email,
    date_of_birth: toDateInputValue(emp.date_of_birth),
    gender: (emp.gender as Gender) ?? '',
    nationality: emp.nationality ?? '',
    national_id: emp.national_id ?? '',
    address: emp.address ?? '',
    emergency_name: emp.emergency_name ?? '',
    emergency_phone: emp.emergency_phone ?? '',
    branch_id: emp.branch_id ?? '',
    department_id: emp.department_id ?? '',
    position_id: emp.position_id ?? '',
    hire_date: toDateInputValue(emp.hire_date) || new Date().toISOString().slice(0, 10),
    is_stay_in: Boolean(emp.is_stay_in),
    housing_deduction:
      emp.housing_deduction != null && emp.housing_deduction !== '' ? String(emp.housing_deduction) : '',
  }
}

export function UserAccountEditPanel({
  user,
  roles,
  employees,
  saving,
  onSave,
  inModal = false,
  formId,
  onReadyChange,
}: Props) {
  const [tab, setTab] = useState<Tab>('profile')
  const [draft, setDraft] = useState(() => draftFromUser(user, roles))
  const [loadingEmployee, setLoadingEmployee] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [permissionIds, setPermissionIds] = useState<Set<number>>(new Set())
  const [permissionsTouched, setPermissionsTouched] = useState(false)

  const selectedRole = roles.find((r) => r.role_id === draft.role_id) ?? null
  const age = useMemo(() => ageFromDateOfBirth(draft.date_of_birth), [draft.date_of_birth])

  const patch = <K extends keyof UserAccountDraft>(key: K, value: UserAccountDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  const loadOrgOptions = async (branchId: string) => {
    if (!branchId) {
      setDepartments([])
      setPositions([])
      return
    }
    const [depts, pos] = await Promise.all([
      api<Department[]>(`/departments?branch_id=${branchId}`),
      api<Position[]>(`/positions?branch_id=${branchId}`),
    ])
    setDepartments(depts)
    setPositions(pos)
  }

  useEffect(() => {
    setTab('profile')
    setPermissionsTouched(false)
    setPermissionIds(new Set())
    onReadyChange?.(false)

    if (!user.employee_id) {
      setDraft(draftFromUser(user, roles))
      setLoadingEmployee(false)
      onReadyChange?.(true)
      return
    }

    let cancelled = false
    const base = draftFromUser(user, roles)
    setDraft(base)
    setLoadingEmployee(true)

    api<Employee>(`/employees/${user.employee_id}`)
      .then((emp) => {
        if (cancelled) return
        setDraft(mergeEmployeeIntoDraft(base, emp))
        if (emp.branch_id) void loadOrgOptions(emp.branch_id)
      })
      .catch(() => {
        if (!cancelled) setDraft(base)
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingEmployee(false)
          onReadyChange?.(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [user.id, user.employee_id, roles])

  useEffect(() => {
    setPermissionIds(new Set())
    setPermissionsTouched(false)
  }, [selectedRole?.role_slug])

  useEffect(() => {
    api<Branch[]>('/branches')
      .then(setBranches)
      .catch(() => setBranches([]))
  }, [])

  const onLinkEmployee = async (employeeId: string) => {
    if (!employeeId) {
      patch('employee_id', '')
      return
    }
    setLoadingEmployee(true)
    onReadyChange?.(false)
    try {
      const emp = await api<Employee>(`/employees/${employeeId}`)
      setDraft((d) => mergeEmployeeIntoDraft({ ...d, employee_id: employeeId }, emp))
      if (emp.branch_id) await loadOrgOptions(emp.branch_id)
    } finally {
      setLoadingEmployee(false)
      onReadyChange?.(true)
    }
  }

  const onBranchChange = async (branchId: string) => {
    patch('branch_id', branchId)
    patch('department_id', '')
    patch('position_id', '')
    await loadOrgOptions(branchId)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const perms =
      permissionsTouched && selectedRole && selectedRole.role_type !== 'system'
        ? [...permissionIds]
        : null
    void onSave(draft, perms)
  }

  return (
    <form
      id={formId}
      className={`staff-edit-form${inModal ? ' staff-edit-form--modal' : ''}`}
      onSubmit={onSubmit}
    >
      <div className="staff-edit-header">
        <div className="staff-edit-avatar" aria-hidden>{initials(draft, user)}</div>
        <div className="staff-edit-header-text">
          <h3 className="staff-edit-name">{displayName(draft, user)}</h3>
          <p className="staff-edit-email">{draft.email}</p>
          <div className="staff-edit-badges">
            <span className="badge badge-active">{selectedRole?.role_name ?? 'No role'}</span>
            <span className={`badge badge-${draft.account_status === 'active' ? 'active' : 'pending'}`}>
              {draft.account_status === 'active' ? 'Active' : draft.account_status}
            </span>
          </div>
        </div>
      </div>

      <div className="tabs tabs--staff-edit" role="tablist" aria-label="Staff account sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => {
              setTab(t.id)
              if (t.id === 'permissions') setPermissionsTouched(true)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="staff-edit-pane" role="tabpanel">
          <div className="staff-edit-section">
            <h4 className="staff-edit-section-title">Sign-in</h4>
            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => patch('email', e.target.value)}
                  autoComplete="username"
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={draft.password}
                  onChange={(e) => patch('password', e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  autoComplete="new-password"
                />
                <span className="field-hint">Leave empty to keep the current password.</span>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>System role</label>
                <select value={draft.role_id} onChange={(e) => patch('role_id', Number(e.target.value))}>
                  {roles.map((r) => (
                    <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Account status</label>
                <select
                  value={draft.account_status}
                  onChange={(e) => patch('account_status', e.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="awaiting_hr">Awaiting HR</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
            <label className="staff-edit-toggle">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) => patch('is_active', e.target.checked)}
              />
              <span>Allow sign-in when status permits</span>
            </label>
          </div>

          <div className="staff-edit-section">
            <h4 className="staff-edit-section-title">Personal details</h4>
            {!draft.employee_id ? (
              <p className="muted-block">Link an employee record under Position to edit personal details.</p>
            ) : loadingEmployee ? (
              <p className="muted-block">Loading…</p>
            ) : (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>First name</label>
                    <input value={draft.first_name} onChange={(e) => patch('first_name', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Last name</label>
                    <input value={draft.last_name} onChange={(e) => patch('last_name', e.target.value)} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Phone</label>
                    <input value={draft.phone} onChange={(e) => patch('phone', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Date of birth</label>
                    <input
                      type="date"
                      value={draft.date_of_birth}
                      onChange={(e) => patch('date_of_birth', e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Age</label>
                    <input value={age != null ? String(age) : '—'} readOnly disabled className="readonly-field" />
                  </div>
                  <div className="form-group">
                    <label>Gender</label>
                    <select
                      value={draft.gender}
                      onChange={(e) => patch('gender', e.target.value as Gender | '')}
                    >
                      <option value="">—</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not">Prefer not to say</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Nationality</label>
                    <input value={draft.nationality} onChange={(e) => patch('nationality', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Government ID</label>
                    <input value={draft.national_id} onChange={(e) => patch('national_id', e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <textarea rows={2} value={draft.address} onChange={(e) => patch('address', e.target.value)} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Emergency contact</label>
                    <input value={draft.emergency_name} onChange={(e) => patch('emergency_name', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Emergency phone</label>
                    <input value={draft.emergency_phone} onChange={(e) => patch('emergency_phone', e.target.value)} />
                  </div>
                </div>
              </>
            )}
          </div>

          {(user.last_login_at || user.created_at) && (
            <div className="staff-edit-meta">
              {user.last_login_at && <span>Last login {new Date(user.last_login_at).toLocaleString()}</span>}
              {user.created_at && <span>Created {new Date(user.created_at).toLocaleDateString()}</span>}
            </div>
          )}
        </div>
      )}

      {tab === 'position' && (
        <div className="staff-edit-pane" role="tabpanel">
          <div className="staff-edit-section">
            <h4 className="staff-edit-section-title">Employee record</h4>
            <div className="form-group">
              <label>Linked employee</label>
              <select
                value={draft.employee_id}
                onChange={(e) => void onLinkEmployee(e.target.value)}
              >
                <option value="">— Not linked —</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.emp_number} — {emp.first_name} {emp.last_name}
                    {emp.position_title ? ` (${emp.position_title})` : ''}
                  </option>
                ))}
              </select>
              <span className="field-hint">Ties this login to payroll, attendance, and schedules.</span>
            </div>
          </div>

          {draft.employee_id && !loadingEmployee && (
            <div className="staff-edit-section">
              <h4 className="staff-edit-section-title">Organization</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Employee #</label>
                  <input value={draft.emp_number} onChange={(e) => patch('emp_number', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Branch</label>
                  <select
                    value={draft.branch_id}
                    onChange={(e) => void onBranchChange(e.target.value)}
                  >
                    <option value="">—</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Department</label>
                  <select
                    value={draft.department_id}
                    onChange={(e) => patch('department_id', e.target.value)}
                  >
                    <option value="">—</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Position</label>
                  <select
                    value={draft.position_id}
                    onChange={(e) => patch('position_id', e.target.value)}
                  >
                    <option value="">—</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <DatePicker
                  label="Date hired"
                  value={draft.hire_date}
                  onChange={(hire_date) => patch('hire_date', hire_date)}
                  max={new Date().toISOString().slice(0, 10)}
                  required
                />
              </div>
            </div>
          )}

          {draft.employee_id && !loadingEmployee && (
            <div className="staff-edit-section">
              <h4 className="staff-edit-section-title">Stay-in housing</h4>
              <p className="field-hint" style={{ marginTop: 0 }}>
                Monthly amount deducted on payroll (shown on payslip as <strong>HSNG</strong>). Half is taken each semi-monthly run.
              </p>
              <label className="staff-edit-toggle">
                <input
                  type="checkbox"
                  checked={draft.is_stay_in}
                  onChange={(e) => {
                    const checked = e.target.checked
                    patch('is_stay_in', checked)
                    if (!checked) patch('housing_deduction', '')
                  }}
                />
                <span>Employee uses company stay-in housing</span>
              </label>
              {draft.is_stay_in && (
                <div className="form-group" style={{ marginTop: '0.75rem' }}>
                  <label>Housing deduction per month (₱)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 1000"
                    value={draft.housing_deduction}
                    onChange={(e) => patch('housing_deduction', e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {draft.employee_id && loadingEmployee && (
            <p className="muted-block">Loading position details…</p>
          )}
        </div>
      )}

      {tab === 'permissions' && (
        <div className="staff-edit-pane" role="tabpanel">
          <div className="staff-edit-section">
            <p className="muted-block staff-perm-intro">
              Permissions for <strong>{selectedRole?.role_name ?? 'this role'}</strong>.
              Changes apply to every user assigned this role.
            </p>
            <RolePermissionsEditor
              key={selectedRole?.role_slug ?? 'none'}
              role={selectedRole}
              value={permissionIds}
              onChange={setPermissionIds}
              compact
            />
          </div>
        </div>
      )}

      {!inModal && (
        <div className="staff-edit-footer">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </form>
  )
}
