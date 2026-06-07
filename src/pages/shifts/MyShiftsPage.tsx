import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { PageHeader } from '../../components/PageHeader'
import { ScheduleGrid } from '../../components/ScheduleGrid'
import { ShiftSwapModal } from '../../components/ShiftSwapModal'
import { sundayOfWeek, shiftWeek, tomorrowWeekStart } from '../../lib/scheduleWeek'
import { DatePicker } from '../../components/DatePicker'
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
  const { user } = useAuth()
  const [weekStart, setWeekStart] = useState(() => sundayOfWeek())
  const [roster, setRoster] = useState<RosterGrid | null>(null)
  const [coworkers, setCoworkers] = useState<Employee[]>([])
  const [swaps, setSwaps] = useState<ShiftSwap[]>([])
  const [loading, setLoading] = useState(true)
  const [swapCell, setSwapCell] = useState<(RosterGridCell & { date: string }) | null>(null)
  const [swapMode, setSwapMode] = useState(false)

  const load = async (ws: string) => {
    setLoading(true)
    try {
      const [r, s, emps] = await Promise.all([
        api<RosterGrid>(`/shifts/roster?week_start=${encodeURIComponent(ws)}`),
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
    load(weekStart)
  }, [weekStart, user?.employee_id])

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
    await load(weekStart)
  }

  const cancel = async (id: string) => {
    await api(`/shifts/swaps/${id}`, { method: 'PUT', body: JSON.stringify({ action: 'cancel' }) })
    await load(weekStart)
  }

  return (
    <div>
      <PageHeader title="Scheduling" subtitle="See who is scheduled and request shift swaps" />

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

      <div className="schedule-week-toolbar card">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWeekStart((w) => shiftWeek(w, -1))}>
          ← Prev week
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWeekStart(sundayOfWeek())}>
          This week
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setWeekStart(tomorrowWeekStart())}>
          Tomorrow&apos;s week
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWeekStart((w) => shiftWeek(w, 1))}>
          Next week →
        </button>
        <div className="schedule-week-picker-wrap">
          <DatePicker value={weekStart} onChange={(v) => v && setWeekStart(v)} />
        </div>
        <button
          type="button"
          className={`btn btn-sm schedule-swap-toggle${swapMode ? ' btn-primary' : ' btn-ghost'}`}
          onClick={() => setSwapMode((on) => !on)}
          aria-pressed={swapMode}
        >
          {swapMode ? 'Swap mode on' : 'Swap shifts'}
        </button>
      </div>

      {swapMode && (
        <p className="schedule-swap-hint muted-block" style={{ margin: '0 0 1rem' }}>
          Swap links appear on your shifts. Exchanges must be on the <strong>same day</strong>.
        </p>
      )}

      <div className="card schedule-grid-card">
        <ScheduleGrid
          data={roster}
          loading={loading}
          employeeView
          showSwapButtons={swapMode}
          highlightEmployeeId={user?.employee_id ?? null}
          onSwapRequest={setSwapCell}
        />
      </div>

      <ShiftSwapModal
        open={swapCell != null}
        cell={swapCell}
        coworkers={coworkers}
        onClose={() => setSwapCell(null)}
        onSubmitted={() => load(weekStart)}
      />
    </div>
  )
}
