import { getDb } from './db'
import { ValidationError } from './errors'
import { createManualAttendance, getAttendance, updateAttendance } from './attendance'
import { createNotification, notifyUsersWithPermission, userIdForEmployee } from './notifications'
import { writeAuditLog } from './audit-log'
import { unsafe, type SqlValue } from './sql'

/** How far back an employee may request a correction (your decision: 14 days). */
export const CORRECTION_WINDOW_DAYS = 14

const APPROVE_PERMISSION = 'attendance.correct.approve'

const REQUEST_TYPES = ['missing_in', 'missing_out', 'wrong_time', 'missing_both'] as const
type RequestType = (typeof REQUEST_TYPES)[number]

const SELECT_BASE = `
  SELECT cr.*, e.first_name, e.last_name, e.emp_number,
         a.clock_in AS current_clock_in, a.clock_out AS current_clock_out
  FROM attendance_correction_requests cr
  INNER JOIN employees e ON e.id = cr.employee_id
  LEFT JOIN attendance a ON a.id = cr.attendance_id`

function parseTs(value: unknown): Date | null {
  if (value == null || value === '') return null
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function listMyRequests(employeeId: string) {
  return unsafe(`${SELECT_BASE} WHERE cr.employee_id = $1 ORDER BY cr.created_at DESC`, [employeeId])
}

export async function listRequests(status?: string | null) {
  const params: SqlValue[] = []
  let sql = `${SELECT_BASE} WHERE 1=1`
  if (status) {
    params.push(status)
    sql += ` AND cr.status = $${params.length}`
  }
  sql += ' ORDER BY (cr.status = \'pending\') DESC, cr.created_at DESC'
  return unsafe(sql, params)
}

export async function getRequest(id: string) {
  const rows = await unsafe(`${SELECT_BASE} WHERE cr.id = $1 LIMIT 1`, [id])
  return rows[0] ?? null
}

export async function createCorrectionRequest(employeeId: string, payload: Record<string, unknown>) {
  const requestType = String(payload.request_type ?? '') as RequestType
  if (!REQUEST_TYPES.includes(requestType)) {
    throw new ValidationError('Invalid request type')
  }

  const reason = String(payload.reason ?? '').trim()
  if (!reason) throw new ValidationError('A reason is required')

  const rawIn = payload.requested_clock_in != null && payload.requested_clock_in !== ''
    ? String(payload.requested_clock_in)
    : null
  const rawOut = payload.requested_clock_out != null && payload.requested_clock_out !== ''
    ? String(payload.requested_clock_out)
    : null
  const requestedIn = parseTs(rawIn)
  const requestedOut = parseTs(rawOut)
  const attendanceId = payload.attendance_id != null && payload.attendance_id !== ''
    ? String(payload.attendance_id)
    : null

  // Required times per request type.
  if ((requestType === 'missing_in' || requestType === 'missing_both' || requestType === 'wrong_time') && !requestedIn) {
    if (requestType !== 'wrong_time' || !requestedOut) {
      throw new ValidationError('A corrected time-in is required')
    }
  }
  if ((requestType === 'missing_out' || requestType === 'missing_both') && !requestedOut) {
    throw new ValidationError('A corrected time-out is required')
  }
  if (!requestedIn && !requestedOut) {
    throw new ValidationError('Provide a corrected time-in and/or time-out')
  }
  if (requestedIn && requestedOut && requestedOut.getTime() <= requestedIn.getTime()) {
    throw new ValidationError('Time-out must be after time-in')
  }

  const now = Date.now()
  const future = (d: Date | null) => d != null && d.getTime() > now + 5 * 60 * 1000
  if (future(requestedIn) || future(requestedOut)) {
    throw new ValidationError('Requested times cannot be in the future')
  }

  // 14-day window — measured from the corrected date.
  const target = requestedIn ?? requestedOut!
  const earliest = new Date()
  earliest.setHours(0, 0, 0, 0)
  earliest.setDate(earliest.getDate() - CORRECTION_WINDOW_DAYS)
  if (target.getTime() < earliest.getTime()) {
    throw new ValidationError(`Corrections can only be requested for the last ${CORRECTION_WINDOW_DAYS} days`)
  }

  const db = getDb()

  // Confirm the linked record belongs to this employee.
  if (attendanceId) {
    const att = await getAttendance(attendanceId)
    if (!att || String(att.employee_id) !== employeeId) {
      throw new ValidationError('Attendance record not found')
    }
  }

  // Block a second pending request for the same target date.
  const dupes = await db`
    SELECT id FROM attendance_correction_requests
    WHERE employee_id = ${employeeId}
      AND status = 'pending'
      AND DATE(COALESCE(requested_clock_in, requested_clock_out)) = ${dayKey(target)}
    LIMIT 1
  `
  if (dupes.length > 0) {
    throw new ValidationError('You already have a pending correction for that date')
  }

  const [row] = await db`
    INSERT INTO attendance_correction_requests
      (employee_id, attendance_id, request_type, requested_clock_in, requested_clock_out, reason, status)
    VALUES (${employeeId}, ${attendanceId}, ${requestType},
      ${rawIn}, ${rawOut}, ${reason}, 'pending')
    RETURNING id
  `
  const id = String(row.id)

  const nameRows = await db`SELECT first_name, last_name FROM employees WHERE id = ${employeeId} LIMIT 1`
  const name = nameRows[0]
    ? `${nameRows[0].first_name ?? ''} ${nameRows[0].last_name ?? ''}`.trim()
    : 'An employee'
  await notifyUsersWithPermission(
    APPROVE_PERMISSION,
    'attendance_correction_requested',
    'Attendance correction request',
    `${name} requested a time correction for ${dayKey(target)}.`,
    id,
    '/hr/attendance-corrections',
  )

  return getRequest(id)
}

async function notifyDecision(row: Record<string, unknown>, status: 'approved' | 'rejected', note?: string | null) {
  const uid = await userIdForEmployee(String(row.employee_id))
  if (!uid) return
  const target = parseTs(row.requested_clock_in) ?? parseTs(row.requested_clock_out)
  const dateLabel = target ? dayKey(target) : 'your record'
  if (status === 'approved') {
    await createNotification(
      uid,
      'attendance_correction_approved',
      'Correction approved',
      `Your attendance correction for ${dateLabel} was approved.`,
      String(row.id),
      '/dtr',
    )
    return
  }
  await createNotification(
    uid,
    'attendance_correction_rejected',
    'Correction declined',
    `Your attendance correction for ${dateLabel} was declined.${note ? ` Note: ${note}` : ''}`,
    String(row.id),
    '/dtr',
  )
}

export async function approveRequest(id: string, reviewerUserId: string, note?: string | null) {
  const req = await getRequest(id)
  if (!req) return null
  if (String(req.status) !== 'pending') {
    throw new ValidationError('Only pending requests can be approved')
  }

  const employeeId = String(req.employee_id)
  const requestedIn = req.requested_clock_in ? String(req.requested_clock_in) : null
  const requestedOut = req.requested_clock_out ? String(req.requested_clock_out) : null

  let resolvedAttendanceId: string | null = null

  if (req.attendance_id) {
    // Update the existing record.
    const updates: Record<string, unknown> = { method: 'manual' }
    if (requestedIn) updates.clock_in = requestedIn
    if (requestedOut) updates.clock_out = requestedOut
    const updated = await updateAttendance(String(req.attendance_id), updates, reviewerUserId)
    resolvedAttendanceId = updated ? String(updated.id) : String(req.attendance_id)
  } else {
    // Create the missing record (forgot to time in entirely).
    if (!requestedIn) throw new ValidationError('A corrected time-in is required to create the record')
    const created = await createManualAttendance(employeeId, requestedIn, requestedOut, reviewerUserId)
    resolvedAttendanceId = created ? String(created.id) : null
  }

  const db = getDb()
  await db`
    UPDATE attendance_correction_requests
    SET status = 'approved', reviewed_by = ${reviewerUserId}, reviewed_at = NOW(),
        review_note = ${note ?? null}, resolved_attendance_id = ${resolvedAttendanceId}
    WHERE id = ${id}
  `

  await writeAuditLog(
    reviewerUserId,
    'attendance_correction_approved',
    'attendance_correction_requests',
    id,
    { status: 'pending' },
    { status: 'approved', resolved_attendance_id: resolvedAttendanceId, request_type: req.request_type },
  )

  const out = await getRequest(id)
  if (out) await notifyDecision(out, 'approved', note)
  return out
}

export async function rejectRequest(id: string, reviewerUserId: string, note?: string | null) {
  const req = await getRequest(id)
  if (!req) return null
  if (String(req.status) !== 'pending') {
    throw new ValidationError('Only pending requests can be rejected')
  }
  const db = getDb()
  await db`
    UPDATE attendance_correction_requests
    SET status = 'rejected', reviewed_by = ${reviewerUserId}, reviewed_at = NOW(), review_note = ${note ?? null}
    WHERE id = ${id}
  `
  await writeAuditLog(
    reviewerUserId,
    'attendance_correction_rejected',
    'attendance_correction_requests',
    id,
    { status: 'pending' },
    { status: 'rejected' },
  )
  const out = await getRequest(id)
  if (out) await notifyDecision(out, 'rejected', note)
  return out
}

export async function cancelRequest(id: string, employeeId: string) {
  const db = getDb()
  const rows = await db`SELECT * FROM attendance_correction_requests WHERE id = ${id} LIMIT 1`
  const row = rows[0]
  if (!row || String(row.employee_id) !== employeeId) return null
  if (String(row.status) !== 'pending') {
    throw new ValidationError('Only pending requests can be cancelled')
  }
  await db`UPDATE attendance_correction_requests SET status = 'cancelled', reviewed_at = NOW() WHERE id = ${id}`
  return getRequest(id)
}
