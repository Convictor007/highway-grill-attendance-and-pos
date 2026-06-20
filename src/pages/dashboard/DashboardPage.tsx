import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { hasPermission } from '../../lib/auth'
import { isFieldStaff } from '../../lib/roles'
import { PageHeader } from '../../components/PageHeader'
import type { DashboardSummary, LeaveBalance, OrgMasterlistEntry } from '../../types/hrms'

interface HoursSummary {
  from: string
  to: string
  total_hours: number
  shift_count: number
}

interface Announcement {
  id: string
  title: string
  body: string
  priority: string
}

export function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardSummary | null>(null)
  const [clockedIn, setClockedIn] = useState<boolean | null>(null)
  const [onBreak, setOnBreak] = useState(false)
  const [myBalances, setMyBalances] = useState<LeaveBalance[]>([])
  const [weekHours, setWeekHours] = useState<HoursSummary | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [masterlist, setMasterlist] = useState<OrgMasterlistEntry[]>([])
  const isHrView = hasPermission(user, 'reports.view')
  const isCrew = isFieldStaff(user)

  useEffect(() => {
    if (isHrView) {
      api<DashboardSummary>('/dashboard').then(setStats).catch(() => setStats(null))
      api<OrgMasterlistEntry[]>('/dashboard/org-masterlist')
        .then(setMasterlist)
        .catch(() => setMasterlist([]))
    }
    if (isFieldStaff(user) && user?.employee_id) {
      api<{ open: boolean; on_break?: boolean }>('/attendance/status')
        .then((s) => {
          setClockedIn(s.open)
          setOnBreak(!!s.on_break)
        })
        .catch(() => setClockedIn(null))
      api<HoursSummary>('/attendance/summary')
        .then(setWeekHours)
        .catch(() => setWeekHours(null))
    }
    if (hasPermission(user, 'leave.view') && user?.employee_id && !hasPermission(user, 'leave.approve')) {
      const year = new Date().getFullYear()
      api<LeaveBalance[]>(`/leave/balances?year=${year}`)
        .then((rows) => setMyBalances(rows.filter((b) => b.employee_id === user?.employee_id)))
        .catch(() => setMyBalances([]))
    }
    if (
      hasPermission(user, 'announcements.view') ||
      hasPermission(user, 'employees.manage')
    ) {
      api<Announcement[]>('/announcements').then(setAnnouncements).catch(() => setAnnouncements([]))
    }
  }, [user, isHrView])

  const cards = [
    { label: 'Active staff', value: stats?.active_employees, to: '/employees', perm: 'employees.view' },
    { label: 'Present today', value: stats?.present_today, to: '/attendance', perm: 'attendance.view' },
    { label: 'Attendance today', value: stats?.attendance_rate_today != null ? `${stats.attendance_rate_today}%` : undefined, to: '/hr/attendance-stats', perm: 'attendance.view' },
    { label: 'Month hours', value: stats?.month_hours, to: '/hr/attendance-stats', perm: 'attendance.view' },
    { label: 'Pending leave', value: stats?.pending_leave, to: '/leaves', perm: 'leave.view' },
    { label: 'Pending loans', value: stats?.pending_loans, to: '/hr/loans', perm: 'loans.manage' },
    { label: 'Draft payroll', value: stats?.draft_payroll_runs, to: '/payroll', perm: 'payroll.view' },
  ].filter((c) => hasPermission(user, c.perm))

  const name = user?.employee?.first_name ?? user?.email?.split('@')[0] ?? 'there'

  return (
    <div>
      <PageHeader title="HR Dashboard" subtitle={`Welcome back, ${name} · ${user?.role_name}`} />

      {announcements.length > 0 && (
        <div className="stack" style={{ marginBottom: '1.5rem' }}>
          {announcements.map((a) => (
            <div key={a.id} className={`card announce-${a.priority}`}>
              <strong>{a.title}</strong>
              <p style={{ color: 'var(--muted)', marginTop: '0.35rem', fontSize: '0.9rem' }}>{a.body}</p>
            </div>
          ))}
        </div>
      )}

      {isCrew && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 className="section-title">Today</h2>
          <p style={{ marginBottom: '0.5rem' }}>
            Status:{' '}
            <strong>
              {clockedIn === null ? '—' : onBreak ? 'On break' : clockedIn ? 'Clocked in' : 'Clocked out'}
            </strong>
          </p>
          {weekHours && (
            <p style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>
              This week: <strong>{weekHours.total_hours.toFixed(1)}h</strong> across {weekHours.shift_count} shifts
            </p>
          )}
          <div className="quick-actions">
            <Link to="/attendance" className="btn btn-primary">
              {clockedIn ? 'Go to time clock' : 'Clock in'}
            </Link>
            {hasPermission(user, 'leave.apply') && (
              <Link to="/leaves" className="btn btn-ghost">Apply for leave</Link>
            )}
            {hasPermission(user, 'shifts.view.self') && (
              <Link to="/scheduling" className="btn btn-ghost">My shifts</Link>
            )}
            <Link to="/profile" className="btn btn-ghost">Profile</Link>
          </div>
        </div>
      )}

      {myBalances.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 className="section-title">My leave balance</h2>
          <div className="stat-grid">
            {myBalances.map((b) => {
              const rem = Number(b.accrued) - Number(b.used) - Number(b.pending)
              return (
                <div key={b.id} className="card stat-card" style={{ cursor: 'default' }}>
                  <div className="stat-num">{rem.toFixed(0)}</div>
                  <div className="stat-label">{b.leave_type_name} days left</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {isHrView && (
        <p style={{ marginBottom: '1rem' }}>
          <Link to="/hr/reports" className="text-link">
            View full reports
          </Link>
        </p>
      )}

      {cards.length > 0 && (
        <>
          <h2 className="section-title">Overview</h2>
          <div className="stat-grid">
            {cards.map((c) => (
              <Link key={c.label} to={c.to} className="card stat-card">
                <div className="stat-num">{c.value ?? '—'}</div>
                <div className="stat-label">{c.label}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      {isHrView && masterlist.length > 0 && hasPermission(user, 'employees.view') && (
        <div className="card table-wrap" style={{ marginTop: '1.5rem' }}>
          <h2 className="section-title">Organization masterlist</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Branch</th>
                <th>Department</th>
                <th>Position</th>
                <th>Hired</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {masterlist.slice(0, 25).map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.first_name} {e.last_name}
                  </td>
                  <td>{e.branch_name ?? '—'}</td>
                  <td>{e.department_name ?? '—'}</td>
                  <td>{e.position_title ?? '—'}</td>
                  <td>{e.hire_date}</td>
                  <td>{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {masterlist.length > 25 && (
            <p className="muted-block" style={{ padding: '0.75rem 1rem' }}>
              Showing 25 of {masterlist.length}. <Link to="/employees">View all employees</Link>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
