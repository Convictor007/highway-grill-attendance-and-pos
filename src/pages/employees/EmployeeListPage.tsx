import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { type LoadOptions, resolveLoadBehavior } from '../../lib/scroll'
import { useAuth } from '../../context/AuthContext'
import { useNotification } from '../../hooks/useNotification'
import { hasPermission } from '../../lib/auth'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmployeeAvatar } from '../../components/EmployeeAvatar'
import { EmployeeEditModal } from '../../components/EmployeeEditModal'
import type { Branch, Employee } from '../../types/hrms'

type ViewMode = 'card' | 'list' | 'grid'

const VIEW_KEY = 'hg_employee_view_v2'

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
      <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>
        Edit
      </button>
      {emp.status === 'active' && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onTerminate}>
          Terminate
        </button>
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
  const [loading, setLoading] = useState(true)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [view, setView] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(VIEW_KEY) as ViewMode | null
    if (saved === 'list' || saved === 'grid' || saved === 'card') return saved
    return 'card'
  })

  const setViewMode = (mode: ViewMode) => {
    setView(mode)
    localStorage.setItem(VIEW_KEY, mode)
  }

  const load = async (options?: LoadOptions) => {
    const { showLoading, finish } = resolveLoadBehavior(options)
    if (showLoading) setLoading(true)
    try {
      const [emps, br] = await Promise.all([api<Employee[]>('/employees'), api<Branch[]>('/branches')])
      setEmployees(emps)
      setBranches(br)
    } finally {
      setLoading(false)
      finish()
    }
  }

  useEffect(() => {
    load()
  }, [])

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
    <div className="employee-list-page">
      <PageHeader
        title="Employees"
        subtitle="Self-registration on login page · approve under Users"
        actions={viewToggle}
      />

      <EmployeeEditModal
        open={!!editingEmployee}
        employee={editingEmployee}
        branches={branches}
        onClose={() => setEditingEmployee(null)}
        onSaved={() => {
          success('Employee updated')
          load({ silent: true })
        }}
      />

      {loading ? (
        <LoadingBlock />
      ) : view === 'card' ? (
        <div className="employee-cards">
          {employees.map((e) => (
            <article key={e.id} className="employee-card card">
              <div className="employee-card__top">
                <EmployeeAvatar photoUrl={e.photo_url} firstName={e.first_name} lastName={e.last_name} size={52} />
                <div>
                  <strong>
                    {e.first_name} {e.last_name}
                  </strong>
                  <p className="muted-block employee-card__sub">{e.emp_number}</p>
                </div>
                <span className={`badge badge-${e.status}`}>{e.status}</span>
              </div>
              <dl className="employee-card__meta">
                <div>
                  <dt>Branch</dt>
                  <dd>{e.branch_name}</dd>
                </div>
                <div>
                  <dt>Dept</dt>
                  <dd>{e.department_name ?? '—'}</dd>
                </div>
                <div>
                  <dt>Role</dt>
                  <dd>{e.position_title ?? '—'}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{e.phone ?? '—'}</dd>
                </div>
              </dl>
              <EmployeeActions
                emp={e}
                canManage={canManage}
                onEdit={() => setEditingEmployee(e)}
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
                <strong>
                  {e.first_name} {e.last_name}
                </strong>
                <span className="muted-block">
                  {e.emp_number} · {e.position_title ?? '—'} · {e.branch_name}
                </span>
              </div>
              <span className={`badge badge-${e.status}`}>{e.status}</span>
              <EmployeeActions
                emp={e}
                canManage={canManage}
                onEdit={() => setEditingEmployee(e)}
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
              onClick={() => canManage && setEditingEmployee(e)}
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
