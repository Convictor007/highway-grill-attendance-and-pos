import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Modal } from './Modal'
import { TimePicker } from './TimePicker'
import type { ShiftTemplateRecord } from './ShiftTemplateModal'
import type { RosterGridCell } from '../types/hrms'

export type ScheduleCellEditTarget = {
  employeeId: string
  employeeName: string
  date: string
  dateLabel: string
  cell: RosterGridCell
  branchId: string
  weekStart: string
}

type Props = {
  open: boolean
  target: ScheduleCellEditTarget | null
  templates: ShiftTemplateRecord[]
  onClose: () => void
  onSaved: () => void
}

import { normalizeTimeInput } from '../lib/datetime'

function cellMode(cell: RosterGridCell): 'working' | 'rest' {
  if (cell.status === 'day_off') return 'rest'
  if (cell.status === 'working') return 'working'
  if (cell.off && cell.assignment_id) return 'rest'
  return 'working'
}

export function ScheduleCellEditModal({ open, target, templates, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<'working' | 'rest'>('working')
  const [templateId, setTemplateId] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !target) return
    const initialMode = cellMode(target.cell)
    setMode(initialMode)
    setTemplateId('')
    setStartTime(normalizeTimeInput(target.cell.start_time ?? templates[0]?.start_time ?? '09:00'))
    setEndTime(normalizeTimeInput(target.cell.end_time ?? templates[0]?.end_time ?? '17:00'))
    if (target.cell.status === 'unset' && templates[0]) {
      setMode('working')
      setStartTime(normalizeTimeInput(templates[0].start_time))
      setEndTime(normalizeTimeInput(templates[0].end_time))
      setTemplateId(templates[0].id)
    }
    setError(null)
  }, [open, target, templates])

  const applyTemplate = (id: string) => {
    setTemplateId(id)
    const t = templates.find((x) => x.id === id)
    if (!t) return
    setMode('working')
    setStartTime(normalizeTimeInput(t.start_time))
    setEndTime(normalizeTimeInput(t.end_time))
  }

  const save = async () => {
    if (!target) return
    setSaving(true)
    setError(null)
    try {
      await api('/shifts/roster/cell', {
        method: 'POST',
        body: JSON.stringify({
          branch_id: target.branchId,
          week_start: target.weekStart,
          employee_id: target.employeeId,
          shift_date: target.date,
          off: mode === 'rest',
          shift_template_id: mode === 'rest' ? undefined : templateId || undefined,
          start_time: mode === 'rest' ? undefined : startTime,
          end_time: mode === 'rest' ? undefined : endTime,
        }),
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  if (!open || !target) return null

  return (
    <Modal
      open={open}
      title={target.employeeName}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <p className="muted-block" style={{ marginTop: 0 }}>
        {target.dateLabel}
      </p>

      <div className="schedule-mode-picker">
        <label className={`schedule-mode-option${mode === 'working' ? ' schedule-mode-option--active' : ''}`}>
          <input
            type="radio"
            name="schedule-mode"
            checked={mode === 'working'}
            onChange={() => setMode('working')}
          />
          <span>
            <strong>Work shift</strong>
            <small>Employee works this day</small>
          </span>
        </label>
        <label className={`schedule-mode-option${mode === 'rest' ? ' schedule-mode-option--active' : ''}`}>
          <input
            type="radio"
            name="schedule-mode"
            checked={mode === 'rest'}
            onChange={() => setMode('rest')}
          />
          <span>
            <strong>Rest day</strong>
            <small>Weekly day off</small>
          </span>
        </label>
      </div>

      {mode === 'working' && (
        <>
          {templates.length > 0 && (
            <div className="form-group">
              <label>Usual shift</label>
              <select value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">Pick hours manually</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({normalizeTimeInput(t.start_time)}–{normalizeTimeInput(t.end_time)})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="form-row">
            <TimePicker label="Start" value={startTime} onChange={setStartTime} />
            <TimePicker label="End" value={endTime} onChange={setEndTime} />
          </div>
        </>
      )}

      {error && <p className="error-msg" style={{ marginTop: '0.75rem' }}>{error}</p>}
    </Modal>
  )
}
