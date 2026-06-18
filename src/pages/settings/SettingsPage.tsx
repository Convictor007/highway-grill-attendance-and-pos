import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { type LoadOptions, resolveLoadBehavior } from '../../lib/scroll'
import { useAuth } from '../../context/AuthContext'
import { useNotification } from '../../hooks/useNotification'
import { hasPermission } from '../../lib/auth'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { BranchEditModal, type BranchEditInput } from '../../components/BranchEditModal'
import { DepartmentEditModal, type DepartmentEditInput } from '../../components/DepartmentEditModal'
import { PositionEditModal, type PositionEditInput } from '../../components/PositionEditModal'
import { EmptyState } from '../../components/EmptyState'
import type { Branch, Department, Holiday } from '../../types/hrms'
import { DatePicker } from '../../components/DatePicker'

type SettingsBranch = Branch & {
  timezone?: string
  manager_id?: string | null
  default_latitude?: string | number | null
  default_longitude?: string | number | null
}

type SettingsDepartment = Department & {
  branch_name?: string
  cost_center?: string | null
}

type SettingsPosition = PositionEditInput & {
  branch_id?: string
}

type SettingsTab = 'branches' | 'departments' | 'positions' | 'holidays'

function defaultTab(canBranches: boolean, canDepts: boolean, canHolidays: boolean): SettingsTab {
  if (canBranches) return 'branches'
  if (canDepts) return 'departments'
  if (canHolidays) return 'holidays'
  return 'positions'
}

export function SettingsPage() {
  const { user } = useAuth()
  const { success, error: notifyError, confirm } = useNotification()
  const canBranches = hasPermission(user, 'settings.branches.manage')
  const canDepts = hasPermission(user, 'settings.departments.manage')
  const canHolidays = hasPermission(user, 'payroll.view')
  const canManageHolidays = hasPermission(user, 'payroll.manage')
  const [tab, setTab] = useState<SettingsTab>(defaultTab(canBranches, canDepts, canHolidays))
  const [branches, setBranches] = useState<SettingsBranch[]>([])
  const [departments, setDepartments] = useState<SettingsDepartment[]>([])
  const [positions, setPositions] = useState<SettingsPosition[]>([])
  const [positionBranchFilter, setPositionBranchFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [branchForm, setBranchForm] = useState({ name: '', address: '', phone: '' })
  const [deptForm, setDeptForm] = useState({ branch_id: '', name: '', cost_center: '' })
  const [showBranchForm, setShowBranchForm] = useState(false)
  const [showDeptForm, setShowDeptForm] = useState(false)
  const [editingBranch, setEditingBranch] = useState<BranchEditInput | null>(null)
  const [editingDepartment, setEditingDepartment] = useState<DepartmentEditInput | null>(null)
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<PositionEditInput | null>(null)
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear())
  const [showHolidayForm, setShowHolidayForm] = useState(false)
  const [holidayForm, setHolidayForm] = useState({
    holiday_date: '',
    name: '',
    holiday_type: 'national',
    pay_multiplier: '2.00',
    branch_id: '',
  })

  const loadPositions = async (branchId?: string) => {
    const q = branchId ? `?branch_id=${encodeURIComponent(branchId)}` : ''
    setPositions(await api<SettingsPosition[]>(`/settings/positions${q}`))
  }

  const loadHolidays = async (year: number) => {
    if (!canHolidays) return
    setHolidays(await api<Holiday[]>(`/holidays?year=${year}`))
  }

  const load = async (options?: LoadOptions) => {
    const { showLoading, finish } = resolveLoadBehavior(options)
    if (showLoading) setLoading(true)
    try {
      const [b, d] = await Promise.all([
        api<SettingsBranch[]>('/settings/branches'),
        api<SettingsDepartment[]>('/settings/departments'),
      ])
      setBranches(b)
      setDepartments(d)
      if (b[0] && !deptForm.branch_id) setDeptForm((f) => ({ ...f, branch_id: b[0].id }))
      await Promise.all([loadPositions(positionBranchFilter || undefined), loadHolidays(holidayYear)])
    } finally {
      setLoading(false)
      finish()
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onCreateBranch = async (e: FormEvent) => {
    e.preventDefault()
    await api('/settings/branches', { method: 'POST', body: JSON.stringify(branchForm) })
    setBranchForm({ name: '', address: '', phone: '' })
    setShowBranchForm(false)
    load({ silent: true })
  }

  const onCreateDept = async (e: FormEvent) => {
    e.preventDefault()
    await api('/settings/departments', {
      method: 'POST',
      body: JSON.stringify({
        branch_id: deptForm.branch_id,
        name: deptForm.name,
        cost_center: deptForm.cost_center.trim() || undefined,
      }),
    })
    setDeptForm({ branch_id: branches[0]?.id ?? '', name: '', cost_center: '' })
    setShowDeptForm(false)
    load({ silent: true })
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Branches, departments, positions, and holidays"
        actions={
          tab === 'holidays' && canManageHolidays ? (
            <button type="button" className="btn btn-primary" onClick={() => setShowHolidayForm(!showHolidayForm)}>
              {showHolidayForm ? 'Cancel' : 'Add holiday'}
            </button>
          ) : tab === 'branches' && canBranches ? (
            <button type="button" className="btn btn-primary" onClick={() => setShowBranchForm(!showBranchForm)}>
              {showBranchForm ? 'Cancel' : 'Add branch'}
            </button>
          ) : tab === 'departments' && canDepts ? (
            <button type="button" className="btn btn-primary" onClick={() => setShowDeptForm(!showDeptForm)}>
              {showDeptForm ? 'Cancel' : 'Add department'}
            </button>
          ) : tab === 'positions' && canDepts ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setEditingPosition(null)
                setPositionModalOpen(true)
              }}
            >
              Add position
            </button>
          ) : null
        }
      />

      <div className="tabs">
        <button type="button" className={`tab ${tab === 'branches' ? 'active' : ''}`} onClick={() => setTab('branches')}>
          Branches
        </button>
        <button type="button" className={`tab ${tab === 'departments' ? 'active' : ''}`} onClick={() => setTab('departments')}>
          Departments
        </button>
        <button type="button" className={`tab ${tab === 'positions' ? 'active' : ''}`} onClick={() => setTab('positions')}>
          Positions
        </button>
        {canHolidays && (
          <button type="button" className={`tab ${tab === 'holidays' ? 'active' : ''}`} onClick={() => setTab('holidays')}>
            Holidays
          </button>
        )}
      </div>

      {loading && <LoadingBlock />}

      {!loading && tab === 'branches' && (
        <div className="stack">
          {showBranchForm && canBranches && (
            <form className="card" onSubmit={onCreateBranch}>
              <h3 className="section-title">New branch</h3>
              <div className="form-group">
                <label>Name</label>
                <input value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Address</label>
                <input value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input value={branchForm.phone} onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary">Save branch</button>
            </form>
          )}
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Address</th>
                  <th>Map center</th>
                  <th>Phone</th>
                  <th>Active</th>
                  {canBranches && <th />}
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id}>
                    <td>{b.name}</td>
                    <td>{b.address ?? '—'}</td>
                    <td>
                      {b.default_latitude != null && b.default_longitude != null
                        ? `${Number(b.default_latitude).toFixed(4)}, ${Number(b.default_longitude).toFixed(4)}`
                        : '—'}
                    </td>
                    <td>{b.phone ?? '—'}</td>
                    <td>{b.is_active ? 'Yes' : 'No'}</td>
                    {canBranches && (
                      <td>
                        <button type="button" className="text-link" onClick={() => setEditingBranch(b)}>
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canBranches && (
        <BranchEditModal
          open={editingBranch !== null}
          branch={editingBranch}
          onClose={() => setEditingBranch(null)}
          onSaved={() => load({ silent: true })}
        />
      )}

      {!loading && tab === 'departments' && (
        <div className="stack">
          {showDeptForm && canDepts && (
            <form className="card" onSubmit={onCreateDept}>
              <h3 className="section-title">New department</h3>
              <div className="form-group">
                <label>Branch</label>
                <select value={deptForm.branch_id} onChange={(e) => setDeptForm({ ...deptForm, branch_id: e.target.value })} required>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Name</label>
                <input value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Cost center (optional)</label>
                <input
                  value={deptForm.cost_center}
                  onChange={(e) => setDeptForm({ ...deptForm, cost_center: e.target.value })}
                  placeholder="e.g. KITCHEN-01"
                />
              </div>
              <button type="submit" className="btn btn-primary">Save department</button>
            </form>
          )}
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Department</th>
                  <th>Cost center</th>
                  {canDepts && <th />}
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id}>
                    <td>{d.branch_name ?? '—'}</td>
                    <td>{d.name}</td>
                    <td>{d.cost_center ?? '—'}</td>
                    {canDepts && (
                      <td>
                        <button type="button" className="text-link" onClick={() => setEditingDepartment(d)}>
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canDepts && (
        <DepartmentEditModal
          open={editingDepartment !== null}
          department={editingDepartment}
          branches={branches}
          onClose={() => setEditingDepartment(null)}
          onSaved={() => load({ silent: true })}
        />
      )}

      {!loading && tab === 'positions' && (
        <div className="stack">
          <div className="form-group" style={{ maxWidth: 280 }}>
            <label>Filter by branch</label>
            <select
              value={positionBranchFilter}
              onChange={(e) => {
                const value = e.target.value
                setPositionBranchFilter(value)
                loadPositions(value || undefined)
              }}
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="card table-wrap">
            {positions.length === 0 ? (
              <EmptyState
                title="No positions"
                description="Add job titles under each department for employee records and payroll."
              />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Branch</th>
                    <th>Department</th>
                    <th>Title</th>
                    <th>Tipped</th>
                    {canDepts && <th />}
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.id}>
                      <td>{p.branch_name ?? '—'}</td>
                      <td>{p.department_name ?? '—'}</td>
                      <td>{p.title}</td>
                      <td>{p.is_tipped ? 'Yes' : 'No'}</td>
                      {canDepts && (
                        <td>
                          <button
                            type="button"
                            className="text-link"
                            onClick={() => {
                              setEditingPosition(p)
                              setPositionModalOpen(true)
                            }}
                          >
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {canDepts && (
        <PositionEditModal
          open={positionModalOpen}
          position={editingPosition}
          departments={departments}
          onClose={() => {
            setPositionModalOpen(false)
            setEditingPosition(null)
          }}
          onSaved={() => loadPositions(positionBranchFilter || undefined)}
        />
      )}

      {!loading && tab === 'holidays' && canHolidays && (
        <div className="stack">
          <div className="form-group" style={{ maxWidth: 160 }}>
            <label>Year</label>
            <input
              type="number"
              value={holidayYear}
              onChange={(e) => {
                const y = Number(e.target.value)
                setHolidayYear(y)
                loadHolidays(y)
              }}
            />
          </div>

          {showHolidayForm && canManageHolidays && (
            <form
              className="card"
              onSubmit={async (e) => {
                e.preventDefault()
                await api('/holidays', {
                  method: 'POST',
                  body: JSON.stringify({
                    ...holidayForm,
                    branch_id: holidayForm.branch_id || null,
                    pay_multiplier: Number(holidayForm.pay_multiplier),
                  }),
                })
                setShowHolidayForm(false)
                setHolidayForm({
                  holiday_date: '',
                  name: '',
                  holiday_type: 'national',
                  pay_multiplier: '2.00',
                  branch_id: '',
                })
                loadHolidays(holidayYear)
              }}
            >
              <h3 className="section-title">New holiday</h3>
              <div className="form-row">
                <DatePicker
                  label="Date"
                  value={holidayForm.holiday_date}
                  onChange={(v) => setHolidayForm({ ...holidayForm, holiday_date: v })}
                  required
                />
                <div className="form-group">
                  <label>Name</label>
                  <input
                    value={holidayForm.name}
                    onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select
                    value={holidayForm.holiday_type}
                    onChange={(e) => setHolidayForm({ ...holidayForm, holiday_type: e.target.value })}
                  >
                    <option value="national">National</option>
                    <option value="special_non_working">Special non-working</option>
                    <option value="local">Local</option>
                    <option value="company">Company</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Pay multiplier</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={holidayForm.pay_multiplier}
                    onChange={(e) => setHolidayForm({ ...holidayForm, pay_multiplier: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Branch (optional)</label>
                  <select
                    value={holidayForm.branch_id}
                    onChange={(e) => setHolidayForm({ ...holidayForm, branch_id: e.target.value })}
                  >
                    <option value="">All branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-primary">
                Save holiday
              </button>
            </form>
          )}

          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Multiplier</th>
                  <th>Branch</th>
                  {canManageHolidays && <th />}
                </tr>
              </thead>
              <tbody>
                {holidays.map((h) => (
                  <tr key={h.id}>
                    <td>{h.holiday_date}</td>
                    <td>{h.name}</td>
                    <td>{h.holiday_type}</td>
                    <td>{h.pay_multiplier}x</td>
                    <td>{h.branch_name ?? 'All'}</td>
                    {canManageHolidays && (
                      <td>
                        <button
                          type="button"
                          className="text-link text-link--danger"
                          onClick={async () => {
                            if (!(await confirm('Delete this holiday?', { variant: 'danger', confirmLabel: 'Delete' }))) return
                            try {
                              await api(`/holidays/${h.id}`, { method: 'DELETE' })
                              success('Holiday deleted')
                              loadHolidays(holidayYear)
                            } catch (err) {
                              notifyError(err instanceof Error ? err.message : 'Could not delete holiday')
                            }
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {holidays.length === 0 && (
              <p style={{ padding: '1rem', color: 'var(--muted)' }}>No holidays for this year.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
