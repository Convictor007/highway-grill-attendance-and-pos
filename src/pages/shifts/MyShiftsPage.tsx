import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useIsMobile } from '../../hooks/useIsMobile'
import { PageHeader } from '../../components/PageHeader'
import { ScheduleGrid } from '../../components/ScheduleGrid'
import { ScheduleWeekNav } from '../../components/ScheduleWeekNav'
import { ShiftSwapModal } from '../../components/ShiftSwapModal'
import { sundayOfWeek } from '../../lib/scheduleWeek'
import type { Employee, RosterGrid, RosterGridCell } from '../../types/hrms'

type ShiftSwap = {
  id: string
  status: string
  requester_employee_id: string
  target_employee_id: string
  requester_date: string
  requester_start: string
  requester_end: string
  target_date?: string | null
  requester_first?: string
  requester_last?: string
  target_first?: string
  target_last?: string
  message?: string | null
}

export function MyShiftsPage() {
  const { user, loading: authLoading } = useAuth()
  const isMobile = useIsMobile()
  const [weekStart, setWeekStart] = useState(() => sundayOfWeek())
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [filtersReady, setFiltersReady] = useState(false)
  const [departmentTouched, setDepartmentTouched] = useState(false)
  const [roster, setRoster] = useState<RosterGrid | null>(null)
  const [coworkers, setCoworkers] = useState<Employee[]>([])
  const [swaps, setSwaps] = useState<ShiftSwap[]>([])
  const [loading, setLoading] = useState(true)
  const [swapCell, setSwapCell] = useState<(RosterGridCell & { date: string }) | null>(null)
  const [swapMode, setSwapMode] = useState(false)
  const defaultDeptApplied = useRef(false)

  useEffect(() => {
    if (authLoading || defaultDeptApplied.current) return
    defaultDeptApplied.current = true
    if (!departmentTouched && user?.employee?.department_id) {
      setDepartmentFilter(String(user.employee.department_id))
    }
    setFiltersReady(true)
  }, [authLoading, user, departmentTouched])

  const load = async (ws: string, deptId: string) => {
    setLoading(true)
    try {
      const deptQ = deptId ? `&department_id=${encodeURIComponent(deptId)}` : ''
      const [r, s, emps] = await Promise.all([
        api<RosterGrid>(`/shifts/roster?week_start=${encodeURIComponent(ws)}${deptQ}`),
        api<ShiftSwap[]>('/shifts/swaps').catch(() => [] as ShiftSwap[]),
        api<Employee[]>('/shifts/coworkers').catch(() => [] as Employee[]),
      ])
      setRoster(r)
      setSwaps(s)
      setCoworkers(emps)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!filtersReady) return
    load(weekStart, departmentFilter)
  }, [weekStart, departmentFilter, filtersReady, user?.employee_id])

  const departments = roster?.departments ?? []

  const departmentLabel = useMemo(() => {
    if (!departmentFilter) return 'All departments'
    return departments.find((d) => d.id === departmentFilter)?.name ?? 'Your department'
  }, [departmentFilter, departments])

  const incoming = useMemo(
    () => swaps.filter((s) => s.status === 'pending' && s.target_employee_id === user?.employee_id),
    [swaps, user?.employee_id]
  )
  const outgoing = useMemo(
    () => swaps.filter((s) => s.requester_employee_id === user?.employee_id && s.status === 'pending'),
    [swaps, user?.employee_id]
  )

  const respond = async (id: string, action: 'accept' | 'reject') => {
    await api(`/shifts/swaps/${id}`, { method: 'PUT', body: JSON.stringify({ action }) })
    await load(weekStart, departmentFilter)
  }

  const cancel = async (id: string) => {
    await api(`/shifts/swaps/${id}`, { method: 'PUT', body: JSON.stringify({ action: 'cancel' }) })
    await load(weekStart, departmentFilter)
  }

  return (
    <div>
      <PageHeader
        title="Scheduling"
        subtitle={isMobile ? undefined : 'See who is scheduled and request shift swaps'}
      />

      {(incoming.length > 0 || outgoing.length > 0) && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 className="section-title">Shift swap requests</h3>
          {incoming.map((s) => (
            <div key={s.id} className="swap-request-row">
              <div>
                <strong>
                  {s.requester_first} {s.requester_last}
                </strong>{' '}
                wants to swap {s.requester_date} ({s.requester_start?.slice(0, 5)}–{s.requester_end?.slice(0, 5)})
                {s.message && <span className="muted-block"> — {s.message}</span>}
              </div>
              <div className="quick-actions" style={{ margin: 0 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => respond(s.id, 'accept')}>
                  Accept
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => respond(s.id, 'reject')}>
                  Decline
                </button>
              </div>
            </div>
          ))}
          {outgoing.map((s) => (
            <div key={s.id} className="swap-request-row">
              <div>
                Pending swap with {s.target_first} {s.target_last} · {s.requester_date}
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => cancel(s.id)}>
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}

      <ScheduleWeekNav
        weekStart={weekStart}
        onWeekStartChange={setWeekStart}
        trailing={
          <button
            type="button"
            className={`btn schedule-swap-toggle${swapMode ? ' btn-primary' : ' btn-ghost'}`}
            onClick={() => setSwapMode((on) => !on)}
            aria-pressed={swapMode}
          >
            {swapMode ? 'Swap mode on' : 'Swap shifts'}
          </button>
        }
      >
        <div className="form-group schedule-toolbar-department" style={{ margin: 0 }}>
          <label>Department</label>
          <select
            value={departmentFilter}
            disabled={!filtersReady || departments.length === 0}
            onChange={(e) => {
              setDepartmentTouched(true)
              setDepartmentFilter(e.target.value)
            }}
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </ScheduleWeekNav>

      {departmentFilter !== '' && (
        <p className="muted-block schedule-context-line">
          Showing <strong>{departmentLabel}</strong> schedule for this week.
        </p>
      )}

      {swapMode && (
        <p className="schedule-swap-hint muted-block">
          Swap links appear on your shifts. Exchanges must be on the <strong>same day</strong>.
        </p>
      )}

      <div className="card schedule-grid-card">
        <ScheduleGrid
          data={roster}
          loading={loading || !filtersReady}
          employeeView
          showSwapButtons={swapMode}
          highlightEmployeeId={user?.employee_id ?? null}
          onSwapRequest={setSwapCell}
          emptyMessage={
            departmentFilter
              ? 'No employees in this department for the selected week.'
              : 'No active employees for this branch.'
          }
        />
      </div>

      <ShiftSwapModal
        open={swapCell != null}
        cell={swapCell}
        coworkers={coworkers}
        onClose={() => setSwapCell(null)}
        onSubmitted={() => load(weekStart, departmentFilter)}
      />
    </div>
  )
}
