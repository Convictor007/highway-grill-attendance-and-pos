import { getDb, nullableInt } from './db'
import { addDays, normalizeWeekStartSunday, todayIso, toIsoDateString } from './date-utils'
import { normalizeCalendarDate, todayInBranchTz } from './branch-time'
import { ValidationError } from './errors'
import { unsafe, unsafeExec, type SqlValue } from './sql'

export async function templates(branchId?: string | null) {
  const db = getDb()
  if (branchId) {
    return db`
      SELECT st.*, b.name AS branch_name FROM shift_templates st
      INNER JOIN branches b ON b.id = st.branch_id
      WHERE st.branch_id = ${branchId} ORDER BY b.name, st.start_time
    `
  }
  return db`
    SELECT st.*, b.name AS branch_name FROM shift_templates st
    INNER JOIN branches b ON b.id = st.branch_id ORDER BY b.name, st.start_time
  `
}

export async function createTemplate(data: Record<string, unknown>) {
  const db = getDb()
  const [row] = await db`
    INSERT INTO shift_templates (branch_id, name, start_time, end_time, break_mins, color_hex)
    VALUES (${String(data.branch_id)}, ${String(data.name)}, ${String(data.start_time)},
      ${String(data.end_time)}, ${Number(data.break_mins ?? 0)}, ${data.color_hex ? String(data.color_hex) : null})
    RETURNING id
  `
  const rows = await db`SELECT * FROM shift_templates WHERE id = ${row.id}`
  return rows[0]
}

export async function updateTemplate(id: string, data: Record<string, unknown>) {
  const fields = ['branch_id', 'name', 'start_time', 'end_time', 'break_mins', 'color_hex']
  const updates: Record<string, unknown> = {}
  for (const f of fields) if (f in data) updates[f] = data[f]
  if (Object.keys(updates).length === 0) {
    const rows = await getDb()`SELECT * FROM shift_templates WHERE id = ${id}`
    return rows[0] ?? null
  }
  const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ')
  await unsafeExec(`UPDATE shift_templates SET ${sets} WHERE id = $1`, [id, ...Object.values(updates) as SqlValue[]])
  const rows = await getDb()`
    SELECT st.*, b.name AS branch_name FROM shift_templates st
    INNER JOIN branches b ON b.id = st.branch_id WHERE st.id = ${id}
  `
  return rows[0] ?? null
}

export async function deleteTemplate(id: string) {
  const count = await unsafeExec(`DELETE FROM shift_templates WHERE id = $1`, [id])
  return count > 0
}

export async function schedules(branchId?: string | null) {
  const db = getDb()
  if (branchId) {
    return db`
      SELECT s.*, b.name AS branch_name FROM schedules s
      INNER JOIN branches b ON b.id = s.branch_id
      WHERE s.week_start > '2000-01-01' AND s.branch_id = ${branchId}
      ORDER BY s.week_start DESC
    `
  }
  return db`
    SELECT s.*, b.name AS branch_name FROM schedules s
    INNER JOIN branches b ON b.id = s.branch_id
    WHERE s.week_start > '2000-01-01' ORDER BY s.week_start DESC
  `
}

export async function getSchedule(id: string) {
  const db = getDb()
  const rows = await db`
    SELECT s.*, b.name AS branch_name FROM schedules s
    INNER JOIN branches b ON b.id = s.branch_id WHERE s.id = ${id} LIMIT 1
  `
  return rows[0] ?? null
}

async function findScheduleForWeek(branchId: string, weekStart: string) {
  const db = getDb()
  const rows = await db`
    SELECT * FROM schedules WHERE branch_id = ${branchId} AND week_start = ${weekStart} LIMIT 1
  `
  return rows[0] ?? null
}

export async function createSchedule(data: Record<string, unknown>, userId?: string | null) {
  if (!data.branch_id || !data.week_start) throw new ValidationError('branch_id and week_start are required')
  const weekStart = normalizeWeekStartSunday(String(data.week_start))
  const db = getDb()
  const [row] = await db`
    INSERT INTO schedules (branch_id, week_start, status, published_by, published_at)
    VALUES (${String(data.branch_id)}, ${weekStart}, ${String(data.status ?? 'draft')},
      ${userId ? nullableInt(userId) : null}, NOW())
    RETURNING id
  `
  return (await getSchedule(String(row.id)))!
}

export async function updateSchedule(id: string, data: Record<string, unknown>, userId: string) {
  const existing = await getSchedule(id)
  if (!existing) return null
  const updates: Record<string, unknown> = {}
  if (data.status) {
    updates.status = String(data.status)
    if (data.status === 'published') {
      updates.published_by = userId
      updates.published_at = new Date().toISOString()
    }
  }
  if ('day_footnotes' in data) updates.day_footnotes = JSON.stringify(data.day_footnotes)
  if (Object.keys(updates).length === 0) return existing
  const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ')
  await unsafeExec(`UPDATE schedules SET ${sets} WHERE id = $1`, [id, ...Object.values(updates) as SqlValue[]])
  return getSchedule(id)
}

export async function ensureSchedule(branchId: string, weekStart: string, userId: string) {
  const ws = normalizeWeekStartSunday(weekStart)
  const existing = await findScheduleForWeek(branchId, ws)
  if (existing) return existing
  return createSchedule({ branch_id: branchId, week_start: ws, status: 'draft' }, userId)
}

export async function assignments(scheduleId?: string | null) {
  const db = getDb()
  if (scheduleId) {
    return db`
      SELECT sa.*, e.emp_number, e.first_name, e.last_name, st.name AS shift_name
      FROM shift_assignments sa
      INNER JOIN employees e ON e.id = sa.employee_id
      LEFT JOIN shift_templates st ON st.id = sa.shift_template_id
      WHERE sa.schedule_id = ${scheduleId}
      ORDER BY sa.shift_date, sa.start_time
    `
  }
  return db`
    SELECT sa.*, e.emp_number, e.first_name, e.last_name, st.name AS shift_name
    FROM shift_assignments sa
    INNER JOIN employees e ON e.id = sa.employee_id
    LEFT JOIN shift_templates st ON st.id = sa.shift_template_id
    ORDER BY sa.shift_date, sa.start_time
  `
}

export async function addAssignment(data: Record<string, unknown>) {
  const db = getDb()
  const [row] = await db`
    INSERT INTO shift_assignments (schedule_id, employee_id, shift_template_id, shift_date, start_time, end_time, break_mins, notes)
    VALUES (${String(data.schedule_id)}, ${String(data.employee_id)},
      ${data.shift_template_id ? String(data.shift_template_id) : null}, ${String(data.shift_date)},
      ${String(data.start_time)}, ${String(data.end_time)}, ${Number(data.break_mins ?? 0)},
      ${data.notes ? String(data.notes) : null})
    RETURNING id
  `
  const rows = await db`SELECT * FROM shift_assignments WHERE id = ${row.id}`
  return rows[0]
}

export async function updateAssignment(id: string, data: Record<string, unknown>) {
  const db = getDb()
  const existing = await db`SELECT * FROM shift_assignments WHERE id = ${id} LIMIT 1`
  if (!existing[0]) return null
  const fields = ['shift_template_id', 'start_time', 'end_time', 'break_mins', 'notes']
  const updates: Record<string, unknown> = {}
  for (const f of fields) if (f in data) updates[f] = data[f]
  if (Object.keys(updates).length === 0) return existing[0]
  const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ')
  await unsafeExec(`UPDATE shift_assignments SET ${sets} WHERE id = $1`, [id, ...Object.values(updates) as SqlValue[]])
  const rows = await db`SELECT * FROM shift_assignments WHERE id = ${id}`
  return rows[0] ?? null
}

export async function deleteAssignment(id: string) {
  const count = await unsafeExec(`DELETE FROM shift_assignments WHERE id = $1`, [id])
  return count > 0
}

export async function myShifts(employeeId: string, from?: string | null, to?: string | null) {
  const f = from ?? normalizeWeekStartSunday(todayInBranchTz())
  const t = to ?? addDays(f, 6)
  const db = getDb()
  const rows = await db`
    SELECT sa.*, st.name AS shift_name, st.color_hex, sch.status AS schedule_status
    FROM shift_assignments sa
    INNER JOIN schedules sch ON sch.id = sa.schedule_id
    LEFT JOIN shift_templates st ON st.id = sa.shift_template_id
    WHERE sa.employee_id = ${employeeId} AND sa.shift_date BETWEEN ${f} AND ${t}
      AND (sa.notes IS NULL OR sa.notes != 'REST_DAY')
      AND sch.status IN ('published', 'locked', 'draft')
    ORDER BY sa.shift_date, sa.start_time
  `
  return rows.map((row) => ({
    ...row,
    shift_date: normalizeCalendarDate(row.shift_date),
  }))
}

export async function coworkers(employeeId: string) {
  const db = getDb()
  return db`
    SELECT e.id, e.emp_number, e.first_name, e.last_name, e.branch_id, e.status
    FROM employees e
    INNER JOIN employees self ON self.branch_id = e.branch_id AND self.id = ${employeeId}
    WHERE e.id != ${employeeId} AND e.status = 'active'
    ORDER BY e.last_name, e.first_name
  `
}

export async function upsertRosterCell(data: Record<string, unknown>, userId: string) {
  const branchId = String(data.branch_id ?? '')
  const weekStart = normalizeWeekStartSunday(data.week_start ? String(data.week_start) : null)
  const employeeId = String(data.employee_id ?? '')
  const shiftDate = String(data.shift_date ?? '')
  if (!branchId || !employeeId || !shiftDate) {
    throw new ValidationError('branch_id, employee_id, and shift_date are required')
  }
  const schedule = await ensureSchedule(branchId, weekStart, userId)
  const db = getDb()
  await db`
    DELETE FROM shift_assignments WHERE schedule_id = ${schedule.id} AND employee_id = ${employeeId} AND shift_date = ${shiftDate}
  `
  if (data.off) {
    const [rest] = await db`
      INSERT INTO shift_assignments (schedule_id, employee_id, shift_date, start_time, end_time, break_mins, notes)
      VALUES (${schedule.id}, ${employeeId}, ${shiftDate}, '00:00:00', '00:00:00', 0, 'REST_DAY')
      RETURNING id
    `
    return { schedule_id: schedule.id, rest_day: true, assignment_id: rest.id }
  }
  if (!data.start_time || !data.end_time) {
    throw new ValidationError('start_time and end_time are required when assigning a shift')
  }
  const assignment = await addAssignment({
    schedule_id: schedule.id,
    employee_id: employeeId,
    shift_template_id: data.shift_template_id,
    shift_date: shiftDate,
    start_time: data.start_time,
    end_time: data.end_time,
    break_mins: data.break_mins ?? 0,
    notes: data.notes,
  })
  return { schedule_id: schedule.id, assignment }
}

async function findBestSourceSchedule(branchId: string, beforeWeekStart: string) {
  const rows = await unsafe(
    `SELECT sch.*, COUNT(sa.id)::int AS assignment_count
     FROM schedules sch INNER JOIN shift_assignments sa ON sa.schedule_id = sch.id
     WHERE sch.branch_id = $1 AND sch.week_start < $2
     GROUP BY sch.id ORDER BY assignment_count DESC, sch.week_start DESC LIMIT 1`,
    [branchId, beforeWeekStart],
  )
  return rows[0] ?? null
}

async function copyAssignmentsFromWeek(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  targetWeekStart: string,
  onlyEmployeeId?: string,
) {
  const sourceWeekStart = toIsoDateString(source.week_start)
  const sourceWeekEnd = addDays(sourceWeekStart, 6)
  const params: SqlValue[] = [String(source.id), sourceWeekStart, sourceWeekEnd]
  let sql = `SELECT sa.employee_id, sa.shift_template_id, sa.shift_date, sa.start_time, sa.end_time, sa.break_mins, sa.notes
             FROM shift_assignments sa WHERE sa.schedule_id = $1 AND sa.shift_date BETWEEN $2 AND $3`
  if (onlyEmployeeId) {
    params.push(onlyEmployeeId)
    sql += ` AND sa.employee_id = $${params.length}`
  }
  const rows = await unsafe(sql, params)
  const db = getDb()
  const activeRows = await db`
    SELECT id FROM employees WHERE branch_id = ${String(source.branch_id)} AND status = 'active'
  `
  const activeIds = new Set(activeRows.map((r) => String(r.id)))
  for (const row of rows) {
    if (!activeIds.has(String(row.employee_id))) continue
    const dayOffset = Math.round(
      (new Date(toIsoDateString(row.shift_date) + 'T12:00:00').getTime() -
        new Date(sourceWeekStart + 'T12:00:00').getTime()) /
        86400000,
    )
    const newDate = addDays(targetWeekStart, dayOffset)
    const exists = await db`
      SELECT id FROM shift_assignments
      WHERE schedule_id = ${String(target.id)} AND employee_id = ${String(row.employee_id)} AND shift_date = ${newDate} LIMIT 1
    `
    if (exists[0]) continue
    await db`
      INSERT INTO shift_assignments (schedule_id, employee_id, shift_template_id, shift_date, start_time, end_time, break_mins, notes)
      VALUES (${String(target.id)}, ${String(row.employee_id)}, ${row.shift_template_id ? String(row.shift_template_id) : null}, ${newDate},
        ${String(row.start_time)}, ${String(row.end_time)}, ${Number(row.break_mins ?? 0)}, ${row.notes ? String(row.notes) : null})
    `
  }
}

export async function ensureScheduleRollover(branchId: string, weekStart: string, userId?: string | null) {
  const ws = normalizeWeekStartSunday(weekStart)
  let schedule = await findScheduleForWeek(branchId, ws)
  const source = await findBestSourceSchedule(branchId, ws)
  if (!schedule) {
    schedule = await createSchedule({ branch_id: branchId, week_start: ws, status: 'published' }, userId)
    if (source?.day_footnotes) {
      await getDb()`UPDATE schedules SET day_footnotes = ${String(source.day_footnotes)} WHERE id = ${String(schedule.id)}`
      schedule = (await findScheduleForWeek(branchId, ws)) ?? schedule
    }
  }
  if (source) {
    await copyAssignmentsFromWeek(source, schedule, ws)
    const db = getDb()
    const active = await db`SELECT id FROM employees WHERE branch_id = ${branchId} AND status = 'active'`
    const weekEnd = addDays(ws, 6)
    for (const emp of active) {
      const count = await db`
        SELECT COUNT(*)::int AS c FROM shift_assignments
        WHERE schedule_id = ${String(schedule.id)} AND employee_id = ${String(emp.id)}
          AND shift_date BETWEEN ${ws} AND ${weekEnd}
      `
      if (Number(count[0]?.c ?? 0) >= 7) continue
      const src = await findBestSourceSchedule(branchId, ws)
      if (src) await copyAssignmentsFromWeek(src, schedule, ws, String(emp.id))
    }
  }
  return (await findScheduleForWeek(branchId, ws)) ?? schedule
}

function formatShiftLabel(start: string, end: string) {
  const formatPart = (time: string) => {
    const h = parseInt(String(time).slice(0, 2), 10)
    const m = String(time).slice(3, 5)
    if (Number.isNaN(h)) return '—'
    const hour12 = h === 0 || h === 12 ? 12 : h > 12 ? h - 12 : h
    const meridiem = h >= 12 ? 'pm' : 'am'
    const minutePart = m !== '00' ? `:${m}` : ''
    return `${hour12}${minutePart}${meridiem}`
  }
  const startLabel = formatPart(start)
  const endLabel = formatPart(end)
  if (startLabel === '—' || endLabel === '—') return '—'
  return `${startLabel}–${endLabel}`
}

function resolveDayFootnotes(schedule: Record<string, unknown> | null): Record<number, string> {
  if (!schedule?.day_footnotes) return {}
  const raw = schedule.day_footnotes
  const decoded = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!decoded || typeof decoded !== 'object') return {}
  const out: Record<number, string> = {}
  for (const [k, v] of Object.entries(decoded as Record<string, string>)) {
    const t = String(v).trim()
    if (t) out[Number(k)] = t
  }
  return out
}

export async function rosterGrid(
  branchId: string,
  weekStart?: string | null,
  userId?: string | null,
  departmentId?: string | null,
) {
  const ws = normalizeWeekStartSunday(weekStart)
  await ensureScheduleRollover(branchId, ws, userId)
  await ensureScheduleRollover(branchId, addDays(ws, 7), userId)
  const weekEnd = addDays(ws, 6)
  const today = todayIso()
  const tomorrow = addDays(today, 1)
  const schedule = await findScheduleForWeek(branchId, ws)
  const footnotes = resolveDayFootnotes(schedule)
  const labels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const days = labels.map((label, i) => {
    const date = addDays(ws, i)
    const footnote = footnotes[i] ?? null
    return { label, highlight: footnote != null, footnote, day_index: i, date, is_today: date === today, is_tomorrow: date === tomorrow }
  })
  const db = getDb()
  const branchRows = await db`SELECT name FROM branches WHERE id = ${branchId} LIMIT 1`
  const departmentRows = await db`
    SELECT id, name FROM departments WHERE branch_id = ${branchId} ORDER BY name
  `
  const deptFilter = departmentId?.trim() || null
  const employees = deptFilter
    ? await db`
        SELECT e.id, e.emp_number, e.first_name, e.last_name, d.name AS department_name
        FROM employees e LEFT JOIN departments d ON d.id = e.department_id
        WHERE e.branch_id = ${branchId} AND e.status = 'active' AND e.department_id = ${deptFilter}
          AND NOT EXISTS (
            SELECT 1 FROM users u
            INNER JOIN roles r ON r.role_id = u.role_id
            WHERE u.employee_id = e.id AND r.role_slug = 'admin'
          )
        ORDER BY COALESCE(d.name, 'zzz'), e.last_name, e.first_name
      `
    : await db`
        SELECT e.id, e.emp_number, e.first_name, e.last_name, d.name AS department_name
        FROM employees e LEFT JOIN departments d ON d.id = e.department_id
        WHERE e.branch_id = ${branchId} AND e.status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM users u
            INNER JOIN roles r ON r.role_id = u.role_id
            WHERE u.employee_id = e.id AND r.role_slug = 'admin'
          )
        ORDER BY COALESCE(d.name, 'zzz'), e.last_name, e.first_name
      `
  const assigns = await db`
    SELECT sa.id, sa.employee_id, sa.shift_date, sa.start_time, sa.end_time, sa.notes
    FROM shift_assignments sa INNER JOIN schedules sch ON sch.id = sa.schedule_id
    WHERE sch.branch_id = ${branchId} AND sa.shift_date BETWEEN ${ws} AND ${weekEnd}
      AND sch.status IN ('published', 'draft', 'locked')
    ORDER BY sa.shift_date, sa.start_time
  `
  const byKey = new Map<string, Record<string, unknown>>()
  for (const a of assigns) byKey.set(`${a.employee_id}|${toIsoDateString(a.shift_date)}`, a)
  let prevDept: string | null = null
  const rows = employees.map((emp) => {
    const dept = String(emp.department_name ?? '')
    const sectionDivider = prevDept !== null && dept !== prevDept
    prevDept = dept
    const cells = days.map((day) => {
      const a = byKey.get(`${emp.id}|${day.date}`)
      if (!a) return { date: day.date, status: 'unset', label: '', off: false }
      if (a.notes === 'REST_DAY') {
        return { date: day.date, status: 'day_off', label: 'Day off', off: true, assignment_id: a.id }
      }
      return {
        date: day.date,
        status: 'working',
        label: formatShiftLabel(String(a.start_time), String(a.end_time)),
        off: false,
        assignment_id: a.id,
        start_time: a.start_time,
        end_time: a.end_time,
      }
    })
    return {
      employee_id: emp.id,
      display_name: `${emp.first_name} ${emp.last_name}`.trim(),
      emp_number: emp.emp_number,
      department_name: dept || null,
      section_divider: sectionDivider,
      cells,
    }
  })
  return {
    title: 'SCHEDULE',
    branch_id: branchId,
    branch_name: branchRows[0]?.name ?? null,
    schedule_id: schedule?.id ?? null,
    schedule_status: schedule?.status === 'locked' ? 'published' : schedule?.status ?? null,
    editable: true,
    current_date: today,
    week_start: ws,
    week_end: weekEnd,
    is_current_week: today >= ws && today <= weekEnd,
    department_id: deptFilter,
    departments: departmentRows.map((d) => ({ id: String(d.id), name: String(d.name) })),
    days,
    footnotes: days.filter((d) => d.footnote).map((d) => ({ day_index: d.day_index, day_label: d.label, text: d.footnote })),
    rows,
  }
}
