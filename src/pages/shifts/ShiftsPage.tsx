import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState } from '../../components/EmptyState'
import { ShiftTemplateModal, type ShiftTemplateRecord } from '../../components/ShiftTemplateModal'
import { ScheduleGrid } from '../../components/ScheduleGrid'
import { sundayOfWeek, shiftWeek } from '../../lib/scheduleWeek'
import type { Branch, Employee, RosterGrid, Schedule, ShiftAssignment } from '../../types/hrms'

function formatTime(t: string) {
  return t?.slice(0, 5) ?? '—'
}

export function ShiftsPage() {
  const [tab, setTab] = useState<'templates' | 'roster'>('roster')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [templates, setTemplates] = useState<ShiftTemplateRecord[]>([])
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [templateBranchFilter, setTemplateBranchFilter] = useState('')
  const [selectedSchedule, setSelectedSchedule] = useState('')
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplateRecord | null>(null)
  const [scheduleForm, setScheduleForm] = useState({ branch_id: '', week_start: '' })
  const [assignForm, setAssignForm] = useState({
    employee_id: '',
    shift_template_id: '',
    shift_date: '',
    start_time: '09:00',
    end_time: '17:00',
    break_mins: '0',
  })
  const [rosterGrid, setRosterGrid] = useState<RosterGrid | null>(null)
  const [rosterWeekStart, setRosterWeekStart] = useState(() => sundayOfWeek())
  const [rosterBranchId, setRosterBranchId] = useState('')
  const [rosterLoading, setRosterLoading] = useState(false)
  const [swapLog, setSwapLog] = useState<
    {
      id: string
      status: string
      requester_first?: string
      requester_last?: string
      target_first?: string
      target_last?: string
      requester_date: string
      requester_start: string
      requester_end: string
      created_at?: string
    }[]
  >([])

  const loadTemplates = async (branchId?: string) => {
    const q = branchId ? `?branch_id=${encodeURIComponent(branchId)}` : ''
    setTemplates(await api<ShiftTemplateRecord[]>(`/shifts/templates${q}`))
  }

  const load = async () => {
    const [s, b, e] = await Promise.all([
      api<Schedule[]>('/shifts/schedules'),
      api<Branch[]>('/branches'),
      api<Employee[]>('/employees'),
    ])
    setSchedules(s)
    setBranches(b)
    setEmployees(e.filter((x) => x.status === 'active'))
    if (b[0] && !scheduleForm.branch_id) setScheduleForm((f) => ({ ...f, branch_id: b[0].id }))
    if (b[0] && !rosterBranchId) setRosterBranchId(b[0].id)
    if (s[0] && !selectedSchedule) setSelectedSchedule(s[0].id)
    await loadTemplates(templateBranchFilter || undefined)
  }

  const loadRosterGrid = async (branchId: string, weekStart: string) => {
    if (!branchId) return setRosterGrid(null)
    setRosterLoading(true)
    try {
      setRosterGrid(
        await api<RosterGrid>(
          `/shifts/roster?branch_id=${encodeURIComponent(branchId)}&week_start=${encodeURIComponent(weekStart)}`
        )
      )
    } finally {
      setRosterLoading(false)
    }
  }

  const loadAssignments = async (scheduleId: string) => {
    if (!scheduleId) return
    setAssignments(await api<ShiftAssignment[]>(`/shifts/assignments?schedule_id=${scheduleId}`))
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    loadTemplates(templateBranchFilter || undefined)
  }, [templateBranchFilter])

  useEffect(() => {
    if (selectedSchedule) loadAssignments(selectedSchedule)
  }, [selectedSchedule])

  const loadSwapLog = async () => {
    try {
      setSwapLog(await api('/shifts/swaps'))
    } catch {
      setSwapLog([])
    }
  }

  useEffect(() => {
    if (tab === 'roster' && rosterBranchId) {
      loadRosterGrid(rosterBranchId, rosterWeekStart)
      loadSwapLog()
    }
  }, [tab, rosterBranchId, rosterWeekStart])

  useEffect(() => {
    const schedule = schedules.find((s) => s.id === selectedSchedule)
    if (schedule?.week_start) {
      setRosterWeekStart(schedule.week_start)
      setRosterBranchId(schedule.branch_id)
    }
  }, [selectedSchedule, schedules])

  const rosterTemplates = useMemo(() => {
    const schedule = schedules.find((s) => s.id === selectedSchedule)
    if (!schedule) return templates
    return templates.filter((t) => t.branch_id === schedule.branch_id)
  }, [templates, schedules, selectedSchedule])

  const onCreateSchedule = async (e: FormEvent) => {
    e.preventDefault()
    await api('/shifts/schedules', { method: 'POST', body: JSON.stringify(scheduleForm) })
    setShowScheduleForm(false)
    load()
  }

  const onAddAssignment = async (e: FormEvent) => {
    e.preventDefault()
    await api('/shifts/assignments', {
      method: 'POST',
      body: JSON.stringify({
        schedule_id: selectedSchedule,
        employee_id: assignForm.employee_id,
        shift_template_id: assignForm.shift_template_id || undefined,
        shift_date: assignForm.shift_date,
        start_time: assignForm.start_time,
        end_time: assignForm.end_time,
        break_mins: Number(assignForm.break_mins) || 0,
      }),
    })
    setShowAssignForm(false)
    loadAssignments(selectedSchedule)
    if (rosterBranchId) {
      loadRosterGrid(rosterBranchId, rosterWeekStart)
      loadSwapLog()
    }
  }

  const removeAssignment = async (id: string) => {
    if (!confirm('Remove this shift assignment?')) return
    await api(`/shifts/assignments/${id}`, { method: 'DELETE' })
    loadAssignments(selectedSchedule)
    if (rosterBranchId) {
      loadRosterGrid(rosterBranchId, rosterWeekStart)
      loadSwapLog()
    }
  }

  const applyTemplate = (templateId: string) => {
    const t = rosterTemplates.find((x) => x.id === templateId)
    if (!t) {
      setAssignForm((f) => ({ ...f, shift_template_id: templateId }))
      return
    }
    setAssignForm((f) => ({
      ...f,
      shift_template_id: templateId,
      start_time: formatTime(t.start_time),
      end_time: formatTime(t.end_time),
      break_mins: String(t.break_mins ?? 0),
    }))
  }

  const headerActions =
    tab === 'templates' ? (
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          setEditingTemplate(null)
          setTemplateModalOpen(true)
        }}
      >
        Add shift template
      </button>
    ) : (
      <>
        <button type="button" className="btn btn-primary" onClick={() => setShowScheduleForm(!showScheduleForm)}>
          New week schedule
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!selectedSchedule}
          onClick={() => setShowAssignForm(!showAssignForm)}
        >
          Assign shift
        </button>
      </>
    )

  return (
    <div>
      <PageHeader title="Shifts" subtitle="Templates and weekly roster" actions={headerActions} />

      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === 'templates' ? 'active' : ''}`}
          onClick={() => setTab('templates')}
        >
          Templates
        </button>
        <button type="button" className={`tab ${tab === 'roster' ? 'active' : ''}`} onClick={() => setTab('roster')}>
          Roster
        </button>
      </div>

      {tab === 'templates' && (
        <div className="stack">
          <div className="form-group" style={{ maxWidth: 280 }}>
            <label>Filter by branch</label>
            <select value={templateBranchFilter} onChange={(e) => setTemplateBranchFilter(e.target.value)}>
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="card table-wrap">
            {templates.length === 0 ? (
              <EmptyState
                title="No shift templates"
                description="Create reusable shifts like Opening, Mid, or Closing for each branch."
              />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Branch</th>
                    <th>Name</th>
                    <th>Hours</th>
                    <th>Break</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.id}>
                      <td>{t.branch_name ?? '—'}</td>
                      <td>
                        <span
                          className="leave-type-swatch"
                          style={{ backgroundColor: t.color_hex ?? '#378ADD' }}
                          aria-hidden
                        />
                        {t.name}
                      </td>
                      <td>
                        {formatTime(t.start_time)} – {formatTime(t.end_time)}
                      </td>
                      <td>{t.break_mins ?? 0} min</td>
                      <td>
                        <button
                          type="button"
                          className="text-link"
                          onClick={() => {
                            setEditingTemplate(t)
                            setTemplateModalOpen(true)
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'roster' && (
        <>
          {showScheduleForm && (
            <form className="card" style={{ marginBottom: '1rem' }} onSubmit={onCreateSchedule}>
              <div className="form-row">
                <div className="form-group">
                  <label>Branch</label>
                  <select
                    value={scheduleForm.branch_id}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, branch_id: e.target.value })}
                    required
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Week starting (Sunday)</label>
                  <input
                    type="date"
                    value={scheduleForm.week_start}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, week_start: e.target.value })}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary">
                Publish schedule
              </button>
            </form>
          )}

          <div className="form-row" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div className="form-group" style={{ maxWidth: 320, margin: 0 }}>
              <label>Manage schedule week</label>
              <select value={selectedSchedule} onChange={(e) => setSelectedSchedule(e.target.value)}>
                <option value="">Select…</option>
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.branch_name} — week of {s.week_start} ({s.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ maxWidth: 220, margin: 0 }}>
              <label>Branch (grid)</label>
              <select value={rosterBranchId} onChange={(e) => setRosterBranchId(e.target.value)}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="schedule-week-toolbar card" style={{ marginBottom: '1rem' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setRosterWeekStart((w) => shiftWeek(w, -1))}
            >
              ← Prev
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRosterWeekStart(sundayOfWeek())}>
              This week
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setRosterWeekStart((w) => shiftWeek(w, 1))}
            >
              Next →
            </button>
            <input
              type="date"
              className="schedule-week-picker"
              value={rosterWeekStart}
              onChange={(e) => e.target.value && setRosterWeekStart(e.target.value)}
              aria-label="Week starting Sunday"
            />
          </div>

          <div className="card schedule-grid-card" style={{ marginBottom: '1.5rem' }}>
            <ScheduleGrid data={rosterGrid} loading={rosterLoading} />
          </div>

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 className="section-title">Shift swap activity</h3>
            <p className="muted-block" style={{ marginBottom: '0.75rem' }}>
              Recent swap requests and completed swaps. Coworkers accept or decline on their Scheduling page.
            </p>
            {swapLog.filter((s) => s.status === 'pending' || s.status === 'accepted').length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Requester</th>
                      <th>With</th>
                      <th>Shift</th>
                      <th>Status</th>
                      <th>Requested</th>
                    </tr>
                  </thead>
                  <tbody>
                    {swapLog
                      .filter((s) => s.status === 'pending' || s.status === 'accepted')
                      .map((s) => (
                        <tr key={s.id}>
                          <td>
                            {s.requester_first} {s.requester_last}
                          </td>
                          <td>
                            {s.target_first} {s.target_last}
                          </td>
                          <td>
                            {s.requester_date} · {s.requester_start?.slice(0, 5)}–{s.requester_end?.slice(0, 5)}
                          </td>
                          <td>
                            <span
                              className={`badge badge-${s.status === 'accepted' ? 'approved' : 'pending'}`}
                            >
                              {s.status === 'accepted' ? 'Swapped' : 'Pending'}
                            </span>
                          </td>
                          <td>{s.created_at ? new Date(s.created_at).toLocaleString() : '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted-block">No recent swap activity.</p>
            )}
          </div>

          {showAssignForm && selectedSchedule && (
            <form className="card" style={{ marginBottom: '1rem' }} onSubmit={onAddAssignment}>
              <div className="form-row">
                <div className="form-group">
                  <label>Shift template</label>
                  <select
                    value={assignForm.shift_template_id}
                    onChange={(e) => applyTemplate(e.target.value)}
                  >
                    <option value="">Custom times</option>
                    {rosterTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({formatTime(t.start_time)}–{formatTime(t.end_time)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Employee</label>
                  <select
                    value={assignForm.employee_id}
                    onChange={(e) => setAssignForm({ ...assignForm, employee_id: e.target.value })}
                    required
                  >
                    <option value="">Select…</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={assignForm.shift_date}
                    onChange={(e) => setAssignForm({ ...assignForm, shift_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Start</label>
                  <input
                    type="time"
                    value={assignForm.start_time}
                    onChange={(e) => setAssignForm({ ...assignForm, start_time: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>End</label>
                  <input
                    type="time"
                    value={assignForm.end_time}
                    onChange={(e) => setAssignForm({ ...assignForm, end_time: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary">
                Add to roster
              </button>
            </form>
          )}

          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Time</th>
                  <th>Template</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.shift_date}</td>
                    <td>
                      {a.first_name} {a.last_name}
                    </td>
                    <td>
                      {formatTime(a.start_time)} – {formatTime(a.end_time)}
                    </td>
                    <td>{a.shift_name ?? '—'}</td>
                    <td>
                      <button type="button" className="text-link text-link--danger" onClick={() => removeAssignment(a.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {assignments.length === 0 && (
              <p style={{ padding: '1rem', color: 'var(--muted)' }}>No shifts assigned for this week.</p>
            )}
          </div>
        </>
      )}

      <ShiftTemplateModal
        open={templateModalOpen}
        editing={editingTemplate}
        branches={branches}
        onClose={() => {
          setTemplateModalOpen(false)
          setEditingTemplate(null)
        }}
        onSaved={() => loadTemplates(templateBranchFilter || undefined)}
      />
    </div>
  )
}
