import { normalizeCalendarDate, parseClockInstant, DEFAULT_BRANCH_TZ, MANILA_OFFSET_MS } from './branch-time'
import { toIsoDateString, addDays } from './date-utils'
import { periodDateList } from './payroll'
import { resolveAssignmentShiftName } from './shifts'
import { unsafe, type SqlValue } from './sql'
import { ValidationError } from './errors'

export type DtrDayStatus =
  | 'worked'
  | 'incomplete'
  | 'absent'
  | 'rest_day'
  | 'on_leave'
  | 'unscheduled'
  | 'holiday'

export type DtrDayRow = {
  date: string
  status: DtrDayStatus
  status_label: string
  shift_name: string | null
  scheduled_start: string | null
  scheduled_end: string | null
  clock_in: string | null
  clock_out: string | null
  break_start: string | null
  break_end: string | null
  regular_hours: number | null
  actual_hours: number | null
  overtime_hours: number | null
  late_in_minutes: number | null
  early_out_minutes: number | null
  late_out_minutes: number | null
  early_in_minutes: number | null
  leave_type: string | null
  holiday_name: string | null
  remarks: string | null
}

export type DtrReport = {
  employee: {
    id: string
    emp_number: string
    first_name: string
    last_name: string
    branch_name: string | null
    position_title: string | null
  }
  from: string
  to: string
  generated_at: string
  timezone: string
  days: DtrDayRow[]
  totals: {
    regular_hours: number
    actual_hours: number
    overtime_hours: number
    days_worked: number
    days_absent: number
    rest_days: number
    leave_days: number
  }
}

const STATUS_LABELS: Record<DtrDayStatus, string> = {
  worked: 'Present',
  incomplete: 'Incomplete',
  absent: 'Absent',
  rest_day: 'Rest day',
  on_leave: 'On leave',
  unscheduled: 'No schedule',
  holiday: 'Holiday',
}

const MAX_RANGE_DAYS = 93

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatWallTime(hms: string | null | undefined): string {
  if (!hms) return ''
  const match = String(hms).slice(0, 8).match(/^(\d{1,2}):(\d{2})/)
  if (!match) return String(hms).slice(0, 5)
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${pad2(m)} ${ampm}`
}

function formatClockInstant(value: unknown): string {
  const ms = parseClockInstant(value)
  if (!Number.isFinite(ms)) return ''
  const d = new Date(ms + MANILA_OFFSET_MS)
  const h = d.getUTCHours()
  const m = d.getUTCMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${pad2(m)} ${ampm}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function dateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end
}

export function validateDtrRange(from: string, to: string): { from: string; to: string } {
  const f = toIsoDateString(from)
  const t = toIsoDateString(to)
  if (f > t) throw new ValidationError('from must be on or before to')
  const days = periodDateList(f, t).length
  if (days > MAX_RANGE_DAYS) {
    throw new ValidationError(`Date range cannot exceed ${MAX_RANGE_DAYS} days`)
  }
  return { from: f, to: t }
}

export async function buildDtrReport(employeeId: string, from: string, to: string): Promise<DtrReport> {
  const range = validateDtrRange(from, to)

  const empRows = await unsafe<Record<string, unknown>>(
    `SELECT e.id, e.emp_number, e.first_name, e.last_name, e.branch_id,
      b.name AS branch_name, p.title AS position_title
     FROM employees e
     LEFT JOIN branches b ON b.id = e.branch_id
     LEFT JOIN positions p ON p.id = e.position_id
     WHERE e.id = $1 LIMIT 1`,
    [employeeId],
  )
  const emp = empRows[0]
  if (!emp) throw new ValidationError('Employee not found')

  const branchId = emp.branch_id ? String(emp.branch_id) : null

  const templates = branchId
    ? await unsafe<Record<string, unknown>>(
        `SELECT id, name, start_time, end_time FROM shift_templates WHERE branch_id = $1`,
        [branchId],
      )
    : []

  const assignments = await unsafe<Record<string, unknown>>(
    `SELECT sa.*, st.name AS shift_name
     FROM shift_assignments sa
     INNER JOIN schedules sch ON sch.id = sa.schedule_id AND sch.status IN ('published', 'locked', 'draft')
     LEFT JOIN shift_templates st ON st.id = sa.shift_template_id
     WHERE sa.employee_id = $1 AND sa.shift_date BETWEEN $2 AND $3
     ORDER BY sa.shift_date, sa.start_time`,
    [employeeId, range.from, range.to],
  )
  const assignByDate: Record<string, Record<string, unknown>> = {}
  for (const row of assignments) {
    const d = normalizeCalendarDate(row.shift_date)
    if (!assignByDate[d]) assignByDate[d] = row
  }

  const attendanceRows = await unsafe<Record<string, unknown>>(
    `SELECT * FROM attendance
     WHERE employee_id = $1 AND DATE(clock_in) BETWEEN $2 AND $3
     ORDER BY clock_in`,
    [employeeId, range.from, range.to],
  )
  const attByDate: Record<string, Record<string, unknown>[]> = {}
  for (const row of attendanceRows) {
    const d = normalizeCalendarDate(row.clock_in)
    if (!attByDate[d]) attByDate[d] = []
    attByDate[d].push(row)
  }

  const leaveRows = await unsafe<Record<string, unknown>>(
    `SELECT lr.start_date, lr.end_date, lt.name AS leave_type_name
     FROM leave_requests lr
     INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
     WHERE lr.employee_id = $1 AND lr.status = 'approved'
       AND lr.start_date <= $3 AND lr.end_date >= $2`,
    [employeeId, range.from, range.to],
  )
  const leaveOnDate: Record<string, string> = {}
  for (const lr of leaveRows) {
    const start = normalizeCalendarDate(lr.start_date)
    const end = normalizeCalendarDate(lr.end_date)
    let d = start
    while (d <= end) {
      if (dateInRange(d, range.from, range.to)) {
        leaveOnDate[d] = String(lr.leave_type_name ?? 'Leave')
      }
      d = addDays(d, 1)
    }
  }

  const holidayParams: SqlValue[] = [range.from, range.to]
  let holidaySql = `SELECT holiday_date, name FROM holidays
    WHERE holiday_date BETWEEN $1 AND $2`
  if (branchId) {
    holidayParams.push(branchId)
    holidaySql += ` AND (branch_id IS NULL OR branch_id = $${holidayParams.length})`
  } else {
    holidaySql += ' AND branch_id IS NULL'
  }
  const holidayRows = await unsafe<Record<string, unknown>>(holidaySql, holidayParams)
  const holidayOnDate: Record<string, string> = {}
  for (const h of holidayRows) {
    holidayOnDate[normalizeCalendarDate(h.holiday_date)] = String(h.name ?? 'Holiday')
  }

  const days: DtrDayRow[] = []
  let totalRegular = 0
  let totalActual = 0
  let totalOt = 0
  let daysWorked = 0
  let daysAbsent = 0
  let restDays = 0
  let leaveDays = 0

  for (const date of periodDateList(range.from, range.to)) {
    const assignment = assignByDate[date] ?? null
    const isRest = assignment?.notes === 'REST_DAY'
    const holidayName = holidayOnDate[date] ?? null
    const leaveType = leaveOnDate[date] ?? null
    const records = attByDate[date] ?? []

    let shiftName: string | null = null
    let schedStart: string | null = null
    let schedEnd: string | null = null
    if (assignment && !isRest) {
      schedStart = String(assignment.start_time ?? '').slice(0, 8)
      schedEnd = String(assignment.end_time ?? '').slice(0, 8)
      shiftName = resolveAssignmentShiftName(
        templates as { name: unknown; start_time: unknown; end_time: unknown }[],
        assignment.start_time,
        assignment.end_time,
        assignment.shift_name,
      )
    }

    let status: DtrDayStatus
    let remarks: string | null = null

    if (records.length > 0) {
      const open = records.some((r) => !r.clock_out)
      status = open ? 'incomplete' : 'worked'
      if (holidayName) remarks = holidayName
    } else if (isRest) {
      status = 'rest_day'
      restDays += 1
    } else if (leaveType) {
      status = 'on_leave'
      leaveDays += 1
    } else if (holidayName && assignment) {
      status = 'holiday'
      remarks = holidayName
    } else if (assignment) {
      status = 'absent'
      daysAbsent += 1
    } else if (holidayName) {
      status = 'holiday'
      remarks = holidayName
    } else {
      status = 'unscheduled'
    }

    let clockIn: string | null = null
    let clockOut: string | null = null
    let breakStart: string | null = null
    let breakEnd: string | null = null
    let regularHours: number | null = null
    let actualHours: number | null = null
    let overtimeHours: number | null = null
    let lateIn: number | null = null
    let earlyOut: number | null = null
    let lateOut: number | null = null
    let earlyIn: number | null = null

    if (records.length > 0) {
      const first = records[0]
      const last = records[records.length - 1]
      clockIn = formatClockInstant(first.clock_in)
      clockOut = last.clock_out ? formatClockInstant(last.clock_out) : null
      breakStart = first.break_start ? formatClockInstant(first.break_start) : null
      breakEnd = first.break_end ? formatClockInstant(first.break_end) : null

      let reg = 0
      let act = 0
      let ot = 0
      let late = 0
      let early = 0
      let lateOutSum = 0
      let earlyInSum = 0
      for (const r of records) {
        reg += Number(r.regular_hours ?? 0)
        act += Number(r.actual_hours ?? 0)
        ot += Number(r.overtime_hours ?? 0)
        late += Number(r.late_in_minutes ?? 0)
        early += Number(r.early_out_minutes ?? 0)
        lateOutSum += Number(r.late_out_minutes ?? 0)
        earlyInSum += Number(r.early_in_minutes ?? 0)
      }
      regularHours = round2(reg)
      actualHours = round2(act)
      overtimeHours = round2(ot)
      lateIn = late > 0 ? late : null
      earlyOut = early > 0 ? early : null
      lateOut = lateOutSum > 0 ? lateOutSum : null
      earlyIn = earlyInSum > 0 ? earlyInSum : null

      if (status === 'worked' || status === 'incomplete') {
        daysWorked += status === 'worked' ? 1 : 0
        totalRegular += regularHours ?? 0
        totalActual += actualHours ?? 0
        totalOt += overtimeHours ?? 0
      }
    }

    days.push({
      date,
      status,
      status_label: STATUS_LABELS[status],
      shift_name: isRest ? 'Rest day' : shiftName,
      scheduled_start: schedStart ? formatWallTime(schedStart) : null,
      scheduled_end: schedEnd ? formatWallTime(schedEnd) : null,
      clock_in: clockIn,
      clock_out: clockOut,
      break_start: breakStart,
      break_end: breakEnd,
      regular_hours: regularHours,
      actual_hours: actualHours,
      overtime_hours: overtimeHours && overtimeHours > 0 ? overtimeHours : null,
      late_in_minutes: lateIn,
      early_out_minutes: earlyOut,
      late_out_minutes: lateOut,
      early_in_minutes: earlyIn,
      leave_type: leaveType,
      holiday_name: holidayName,
      remarks,
    })
  }

  return {
    employee: {
      id: String(emp.id),
      emp_number: String(emp.emp_number ?? ''),
      first_name: String(emp.first_name ?? ''),
      last_name: String(emp.last_name ?? ''),
      branch_name: emp.branch_name ? String(emp.branch_name) : null,
      position_title: emp.position_title ? String(emp.position_title) : null,
    },
    from: range.from,
    to: range.to,
    generated_at: new Date().toISOString(),
    timezone: DEFAULT_BRANCH_TZ,
    days,
    totals: {
      regular_hours: round2(totalRegular),
      actual_hours: round2(totalActual),
      overtime_hours: round2(totalOt),
      days_worked: daysWorked,
      days_absent: daysAbsent,
      rest_days: restDays,
      leave_days: leaveDays,
    },
  }
}
