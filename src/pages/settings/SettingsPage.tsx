import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { hasPermission } from '../../lib/auth'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { BranchEditModal, type BranchEditInput } from '../../components/BranchEditModal'
import { DepartmentEditModal, type DepartmentEditInput } from '../../components/DepartmentEditModal'
import { PositionEditModal, type PositionEditInput } from '../../components/PositionEditModal'
import { EmptyState } from '../../components/EmptyState'
import type { Branch, Department } from '../../types/hrms'

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

function defaultTab(canBranches: boolean, canDepts: boolean): 'branches' | 'departments' | 'positions' {
  if (canBranches) return 'branches'
  if (canDepts) return 'departments'
  return 'positions'
}

export function SettingsPage() {
  const { user } = useAuth()
  const canBranches = hasPermission(user, 'settings.branches.manage')
  const canDepts = hasPermission(user, 'settings.departments.manage')
  const [tab, setTab] = useState<'branches' | 'departments' | 'positions'>(defaultTab(canBranches, canDepts))
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

  const loadPositions = async (branchId?: string) => {
    const q = branchId ? `?branch_id=${encodeURIComponent(branchId)}` : ''
    setPositions(await api<SettingsPosition[]>(`/settings/positions${q}`))
  }

  const load = async () => {
    setLoading(true)
    try {
      const [b, d] = await Promise.all([
        api<SettingsBranch[]>('/settings/branches'),
        api<SettingsDepartment[]>('/settings/departments'),
      ])
      setBranches(b)
      setDepartments(d)
      if (b[0] && !deptForm.branch_id) setDeptForm((f) => ({ ...f, branch_id: b[0].id }))
      await loadPositions(positionBranchFilter || undefined)
    } finally {
      setLoading(false)
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
    load()
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
    load()
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Branches, departments, and job positions"
        actions={
          tab === 'branches' && canBranches ? (
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
          onSaved={load}
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
          onSaved={load}
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
                    <th>Pay range</th>
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
                      <td>
                        {p.min_hourly != null || p.max_hourly != null
                          ? `₱${p.min_hourly ?? '—'} – ₱${p.max_hourly ?? '—'}`
                          : '—'}
                      </td>
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
    </div>
  )
}
