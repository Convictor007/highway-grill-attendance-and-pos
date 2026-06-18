import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { type LoadOptions, resolveLoadBehavior } from '../../lib/scroll'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import type { Branch } from '../../types/hrms'
import { DatePicker } from '../../components/DatePicker'

interface AttendanceStats {
  from: string
  to: string
  active_employees: number
  total_hours: number
  avg_hours_per_employee: number
  total_days_present: number
  attendance_rate: number
  holiday_hours_worked: number
  approved_overtime_hours: number
  by_employee: {
    id: string
    emp_number: string
    first_name: string
    last_name: string
    total_hours: string
    days_present: string
  }[]
}

export function AttendanceStatsPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchId] = useState('')
  const [from, setFrom] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [stats, setStats] = useState<AttendanceStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async (bid?: string, f?: string, t?: string, options?: LoadOptions) => {
    const { showLoading, finish } = resolveLoadBehavior(options)
    if (showLoading) setLoading(true)
    try {
      const q = new URLSearchParams({ from: f ?? from, to: t ?? to })
      if (bid) q.set('branch_id', bid)
      setStats(await api<AttendanceStats>(`/attendance/statistics?${q}`))
    } finally {
      setLoading(false)
      finish()
    }
  }

  useEffect(() => {
    api<Branch[]>('/branches').then((b) => {
      setBranches(b)
      if (b[0]) setBranchId(b[0].id)
    })
  }, [])

  useEffect(() => {
    if (branchId) load(branchId)
  }, [branchId])

  const onFilter = (e: FormEvent) => {
    e.preventDefault()
    load(branchId || undefined, from, to, { silent: true })
  }

  return (
    <div>
      <PageHeader title="Attendance statistics" subtitle="Hours, presence rate, holiday and overtime totals" />

      <form className="card filter-bar" onSubmit={onFilter}>
        <div className="filter-bar__field filter-bar__field--branch form-group">
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
        <div className="filter-bar__field filter-bar__field--date">
          <DatePicker label="From" value={from} onChange={setFrom} required />
        </div>
        <div className="filter-bar__field filter-bar__field--date">
          <DatePicker label="To" value={to} onChange={setTo} min={from || undefined} required />
        </div>
        <div className="filter-bar__action">
          <button type="submit" className="btn btn-primary">
            Apply
          </button>
        </div>
      </form>

      {loading && <LoadingBlock />}

      {!loading && stats && (
        <>
          <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="card stat-card" style={{ cursor: 'default' }}>
              <div className="stat-num">{stats.total_hours.toFixed(1)}</div>
              <div className="stat-label">Total hours</div>
            </div>
            <div className="card stat-card" style={{ cursor: 'default' }}>
              <div className="stat-num">{stats.attendance_rate}%</div>
              <div className="stat-label">Presence rate</div>
            </div>
            <div className="card stat-card" style={{ cursor: 'default' }}>
              <div className="stat-num">{stats.holiday_hours_worked}</div>
              <div className="stat-label">Holiday hours</div>
            </div>
            <div className="card stat-card" style={{ cursor: 'default' }}>
              <div className="stat-num">{stats.approved_overtime_hours}</div>
              <div className="stat-label">Approved OT hrs</div>
            </div>
          </div>

          <div className="card table-wrap">
            <h3 className="section-title">By employee</h3>
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Days present</th>
                  <th>Total hours</th>
                </tr>
              </thead>
              <tbody>
                {stats.by_employee.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {e.first_name} {e.last_name}
                      {e.emp_number && <span className="muted-inline"> · {e.emp_number}</span>}
                    </td>
                    <td>{e.days_present}</td>
                    <td>{Number(e.total_hours).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
