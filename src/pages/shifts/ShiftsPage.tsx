import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { EmptyState } from '../../components/EmptyState'
import { ShiftTemplateModal, type ShiftTemplateRecord } from '../../components/ShiftTemplateModal'
import { ScheduleGrid, type ScheduleCellEditPayload } from '../../components/ScheduleGrid'
import { ScheduleCellEditModal, type ScheduleCellEditTarget } from '../../components/ScheduleCellEditModal'
import { sundayOfWeek, shiftWeek } from '../../lib/scheduleWeek'
import { DatePicker } from '../../components/DatePicker'
import { useNotification } from '../../hooks/useNotification'
import { formatDateDisplay } from '../../lib/datetime'
import type { Branch, RosterGrid } from '../../types/hrms'

import { normalizeTimeInput } from '../../lib/datetime'

type DepartmentOption = { id: string; name: string }

function formatTime(t: string) {
  return normalizeTimeInput(t)
}

export function ShiftsPage() {
  const { error: notifyError, confirm, success } = useNotification()
  const [tab, setTab] = useState<'templates' | 'roster'>('roster')
  const [templates, setTemplates] = useState<ShiftTemplateRecord[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [templateBranchFilter, setTemplateBranchFilter] = useState('')
  const [cellEditTarget, setCellEditTarget] = useState<ScheduleCellEditTarget | null>(null)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplateRecord | null>(null)
  const [rosterGrid, setRosterGrid] = useState<RosterGrid | null>(null)
  const [rosterWeekStart, setRosterWeekStart] = useState(() => sundayOfWeek())
  const [rosterBranchId, setRosterBranchId] = useState('')
  const [rosterDepartmentId, setRosterDepartmentId] = useState('')
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)
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

  const loadBranches = async () => {
    const b = await api<Branch[]>('/branches')
    setBranches(b)
    if (b[0] && !rosterBranchId) setRosterBranchId(b[0].id)
  }

  const loadRosterGrid = async (branchId: string, weekStart: string, departmentId?: string) => {
    if (!branchId) return setRosterGrid(null)
    setRosterLoading(true)
    try {
      const deptQ = departmentId ? `&department_id=${encodeURIComponent(departmentId)}` : ''
      const grid = await api<RosterGrid>(
        `/shifts/roster?branch_id=${encodeURIComponent(branchId)}&week_start=${encodeURIComponent(weekStart)}${deptQ}`
      )
      setRosterGrid(grid)
      if (grid.departments?.length) setDepartments(grid.departments)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not load roster')
      setRosterGrid(null)
    } finally {
      setRosterLoading(false)
    }
  }

  const loadDepartments = async (branchId: string) => {
    if (!branchId) {
      setDepartments([])
      return
    }
    try {
      const rows = await api<DepartmentOption[]>(`/departments?branch_id=${encodeURIComponent(branchId)}`)
      setDepartments(rows)
    } catch {
      setDepartments([])
    }
  }

  useEffect(() => {
    loadBranches()
  }, [])

  useEffect(() => {
    loadTemplates(templateBranchFilter || undefined)
  }, [templateBranchFilter])

  const loadSwapLog = async () => {
    try {
      setSwapLog(await api('/shifts/swaps'))
    } catch {
      setSwapLog([])
    }
  }

  useEffect(() => {
    if (tab === 'roster' && rosterBranchId) {
      loadRosterGrid(rosterBranchId, rosterWeekStart, rosterDepartmentId || undefined)
      loadSwapLog()
    }
  }, [tab, rosterBranchId, rosterWeekStart, rosterDepartmentId])

  useEffect(() => {
    if (rosterBranchId) loadDepartments(rosterBranchId)
  }, [rosterBranchId])

  const rosterTemplates = useMemo(() => {
    if (!rosterBranchId) return templates
    return templates.filter((t) => t.branch_id === rosterBranchId)
  }, [templates, rosterBranchId])

  const publishWeek = async () => {
    const scheduleId = rosterGrid?.schedule_id
    if (!scheduleId) return
    setPublishing(true)
    try {
      await api(`/shifts/schedules/${scheduleId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'published' }),
      })
      await loadRosterGrid(rosterBranchId, rosterWeekStart, rosterDepartmentId || undefined)
    } finally {
      setPublishing(false)
    }
  }

  const refreshRoster = () => {
    if (rosterBranchId) {
      loadRosterGrid(rosterBranchId, rosterWeekStart, rosterDepartmentId || undefined)
      loadSwapLog()
    }
  }

  const deleteTemplate = async (t: ShiftTemplateRecord) => {
    const ok = await confirm(`Delete shift template "${t.name}"? Existing roster cells keep their times but lose the template link.`, {
      title: 'Delete template',
      variant: 'danger',
      confirmLabel: 'Delete',
    })
    if (!ok) return
    try {
      await api(`/shifts/templates/${t.id}`, { method: 'DELETE' })
      success('Shift template deleted')
      await loadTemplates(templateBranchFilter || undefined)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not delete template')
    }
  }

  const openCellEdit = (payload: ScheduleCellEditPayload) => {
    if (!rosterGrid) return
    setCellEditTarget({
      ...payload,
      branchId: rosterGrid.branch_id,
      weekStart: rosterGrid.week_start,
    })
  }

  const weekStatus = rosterGrid?.schedule_status
  const weekLabel = formatDateDisplay(rosterWeekStart)

  return (
    <div>
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
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
          </div>
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
                        {' · '}
                        <button type="button" className="text-link text-link--danger" onClick={() => deleteTemplate(t)}>
                          Delete
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
          <div className="schedule-week-toolbar card" style={{ marginBottom: '1rem' }}>
            <div className="form-group schedule-toolbar-branch" style={{ margin: 0 }}>
              <label>Branch</label>
              <select
                value={rosterBranchId}
                onChange={(e) => {
                  setRosterBranchId(e.target.value)
                  setRosterDepartmentId('')
                }}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group schedule-toolbar-department" style={{ margin: 0 }}>
              <label>Department</label>
              <select value={rosterDepartmentId} onChange={(e) => setRosterDepartmentId(e.target.value)}>
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
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
            <div className="schedule-week-picker-wrap">
              <DatePicker value={rosterWeekStart} onChange={(v) => v && setRosterWeekStart(v)} />
            </div>
            <div className="schedule-toolbar-status">
              <span className="muted-block" style={{ margin: 0 }}>
                Week of {weekLabel}
              </span>
              {weekStatus && (
                <span className={`badge badge-${weekStatus}`} style={{ marginLeft: '0.5rem' }}>
                  {weekStatus}
                </span>
              )}
              {weekStatus === 'draft' && rosterGrid?.schedule_id && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ marginLeft: '0.5rem' }}
                  disabled={publishing}
                  onClick={publishWeek}
                >
                  {publishing ? 'Publishing…' : 'Publish week'}
                </button>
              )}
            </div>
          </div>

          <div className="card schedule-grid-card" style={{ marginBottom: '1.5rem' }}>
            <ScheduleGrid
              data={rosterGrid}
              loading={rosterLoading}
              editable
              onEditCell={openCellEdit}
              emptyMessage={
                rosterDepartmentId
                  ? 'No employees in this department for the selected week.'
                  : 'No active employees for this branch.'
              }
            />
          </div>

          <ScheduleCellEditModal
            open={cellEditTarget !== null}
            target={cellEditTarget}
            templates={rosterTemplates}
            onClose={() => setCellEditTarget(null)}
            onSaved={refreshRoster}
          />

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
