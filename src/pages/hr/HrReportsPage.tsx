import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { type LoadOptions, resolveLoadBehavior } from '../../lib/scroll'
import { useAuth } from '../../context/AuthContext'
import { hasPermission } from '../../lib/auth'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { formatDateShort } from '../../lib/datetime'
import { workerClassLabel } from '../../lib/workerClass'
import type { Branch, DashboardSummary, OrgMasterlistEntry } from '../../types/hrms'

export function HrReportsPage() {
  const { user } = useAuth()
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchId] = useState('')
  const [stats, setStats] = useState<DashboardSummary | null>(null)
  const [masterlist, setMasterlist] = useState<OrgMasterlistEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = async (bid?: string, options?: LoadOptions) => {
    const { showLoading, finish } = resolveLoadBehavior(options)
    if (showLoading) setLoading(true)
    try {
      const q = bid ? `?branch_id=${encodeURIComponent(bid)}` : ''
      const [s, m] = await Promise.all([
        api<DashboardSummary>(`/dashboard${q}`),
        api<OrgMasterlistEntry[]>(`/dashboard/org-masterlist${q}`),
      ])
      setStats(s)
      setMasterlist(m)
    } finally {
      setLoading(false)
      finish()
    }
  }

  useEffect(() => {
    api<Branch[]>('/branches')
      .then((b) => {
        setBranches(b)
        if (b[0] && !branchId) setBranchId(b[0].id)
      })
      .catch(() => setBranches([]))
  }, [])

  useEffect(() => {
    load(branchId || undefined, { silent: Boolean(branchId) })
  }, [branchId])

  const cards = [
    { label: 'Active staff', value: stats?.active_employees, to: '/employees', perm: 'employees.view' },
    { label: 'Present today', value: stats?.present_today, to: '/attendance', perm: 'attendance.view' },
    { label: 'Still clocked in', value: stats?.still_clocked_in, to: '/attendance', perm: 'attendance.view' },
    {
      label: 'Attendance rate',
      value: stats?.attendance_rate_today != null ? `${stats.attendance_rate_today}%` : undefined,
      to: '/hr/attendance-stats',
      perm: 'attendance.view',
    },
    { label: 'Month hours', value: stats?.month_hours, to: '/hr/attendance-stats', perm: 'attendance.view' },
    { label: 'Pending leave', value: stats?.pending_leave, to: '/leaves', perm: 'leave.view' },
    { label: 'Pending loans', value: stats?.pending_loans, to: '/hr/loans', perm: 'loans.manage' },
    { label: 'Draft payroll runs', value: stats?.draft_payroll_runs, to: '/payroll', perm: 'payroll.view' },
  ].filter((c) => hasPermission(user, c.perm))

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle={stats?.date ? `Snapshot for ${stats.date}` : 'Branch workforce and operations summary'}
      />

      <div className="form-row" style={{ marginBottom: '1rem', maxWidth: 320 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Branch</label>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : (
        <>
          <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
            {cards.map((c) => (
              <Link key={c.label} to={c.to} className="card stat-card">
                <div className="stat-num">{c.value ?? '—'}</div>
                <div className="stat-label">{c.label}</div>
              </Link>
            ))}
          </div>

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 className="section-title">Quick links</h3>
            <div className="quick-actions">
              {hasPermission(user, 'attendance.view') && (
                <Link to="/hr/attendance-stats" className="btn btn-ghost">
                  Attendance statistics
                </Link>
              )}
              {hasPermission(user, 'payroll.view') && (
                <Link to="/payroll" className="btn btn-ghost">
                  Payroll runs
                </Link>
              )}
              {hasPermission(user, 'payroll.view') && (
                <Link to="/hr/tips" className="btn btn-ghost">
                  Tips pool
                </Link>
              )}
              {hasPermission(user, 'shifts.manage') && (
                <Link to="/shifts" className="btn btn-ghost">
                  Shift roster
                </Link>
              )}
            </div>
          </div>

          {hasPermission(user, 'employees.view') && (
            <div className="card table-wrap">
              <h3 className="section-title">Organization masterlist</h3>
              {masterlist.length === 0 ? (
                <p className="muted-block" style={{ padding: '1rem 0' }}>
                  No active employees for this filter.
                </p>
              ) : (
                <>
                  <table>
                    <thead>
                      <tr>
                        <th>Emp #</th>
                        <th>Name</th>
                        <th>Branch</th>
                        <th>Department</th>
                        <th>Position</th>
                        <th>Class</th>
                        <th>Hired</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {masterlist.map((e) => (
                        <tr key={e.id}>
                          <td>{e.emp_number}</td>
                          <td>
                            {e.first_name} {e.last_name}
                          </td>
                          <td>{e.branch_name ?? '—'}</td>
                          <td>{e.department_name ?? '—'}</td>
                          <td>{e.position_title ?? '—'}</td>
                          <td>{workerClassLabel(e.worker_class)}</td>
                          <td>{formatDateShort(e.hire_date)}</td>
                          <td>{e.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="muted-block" style={{ padding: '0.75rem 0 0' }}>
                    {masterlist.length} employee(s).{' '}
                    <Link to="/employees">Open employee list</Link>
                  </p>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
