import { useState, type FormEvent } from 'react'
import { apiDownload, ApiError } from '../lib/api'
import { DatePicker } from './DatePicker'

type EmployeeOption = {
  id: string
  emp_number: string
  first_name: string
  last_name: string
}

type Props = {
  employeeId?: string
  employees?: EmployeeOption[]
  defaultFrom?: string
  defaultTo?: string
  compact?: boolean
  /** Employee self-service — omit employee_id (API uses session). */
  selfMode?: boolean
}

function monthStartIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function DtrExportForm({
  employeeId: fixedEmployeeId,
  employees,
  defaultFrom = monthStartIso(),
  defaultTo = todayIso(),
  compact = false,
  selfMode = false,
}: Props) {
  const [employeeId, setEmployeeId] = useState(fixedEmployeeId ?? employees?.[0]?.id ?? '')
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [format, setFormat] = useState<'xlsx' | 'pdf'>('xlsx')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const targetId = fixedEmployeeId ?? employeeId

  const onExport = async (e: FormEvent) => {
    e.preventDefault()
    if (!selfMode && !targetId) {
      setError('Select an employee')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const q = new URLSearchParams({ format, from, to })
      if (!selfMode && targetId) q.set('employee_id', targetId)
      await apiDownload(`/attendance/export?${q}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={compact ? 'dtr-export-form dtr-export-form--compact' : 'card dtr-export-form'} onSubmit={onExport}>
      {!compact && (
        <p className="muted-block" style={{ marginTop: 0 }}>
          Download daily time record with time in/out, overtime, absent, rest day, and leave days.
        </p>
      )}

      {employees && employees.length > 0 && !fixedEmployeeId && (
        <div className="form-group">
          <label htmlFor="dtr-export-employee">Employee</label>
          <select
            id="dtr-export-employee"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            required
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.emp_number} — {emp.first_name} {emp.last_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={compact ? 'filter-bar' : 'filter-bar'} style={compact ? { marginBottom: 0 } : undefined}>
        <div className="filter-bar__field form-group">
          <label>From</label>
          <DatePicker value={from} onChange={setFrom} />
        </div>
        <div className="filter-bar__field form-group">
          <label>To</label>
          <DatePicker value={to} onChange={setTo} />
        </div>
        <div className="filter-bar__field form-group">
          <label>Format</label>
          <select value={format} onChange={(e) => setFormat(e.target.value as 'xlsx' | 'pdf')}>
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="pdf">PDF</option>
          </select>
        </div>
        <div className="filter-bar__actions">
          <button type="submit" className="btn btn-primary" disabled={busy || (!selfMode && !targetId)}>
            {busy ? 'Exporting…' : 'Export DTR'}
          </button>
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}
    </form>
  )
}
