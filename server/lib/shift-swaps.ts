import type { TransactionSql } from 'postgres'
import { getDb } from './db'
import { ValidationError } from './errors'
import { unsafe } from './sql'
import { normalizeCalendarDate, todayInBranchTz } from './branch-time'

// Postgres returns SERIAL ids and DATE columns as numbers/Date objects. The
// frontend compares these against the string `user.employee_id`, so coerce the
// identity fields to strings before they leave the lib.
function normalizeSwapRow<T extends Record<string, unknown>>(row: T | null): T | null {
  if (!row) return row
  for (const key of [
    'id',
    'requester_assignment_id',
    'requester_employee_id',
    'target_employee_id',
    'target_assignment_id',
    'created_by_user_id',
  ]) {
    if (row[key] != null) (row as Record<string, unknown>)[key] = String(row[key])
  }
  return row
}

const SWAP_SELECT = `SELECT sw.*,
  ra.shift_date AS requester_date, ra.start_time AS requester_start, ra.end_time AS requester_end,
  ta.shift_date AS target_date, ta.start_time AS target_start, ta.end_time AS target_end,
  er.first_name AS requester_first, er.last_name AS requester_last,
  et.first_name AS target_first, et.last_name AS target_last
  FROM shift_swap_requests sw
  INNER JOIN shift_assignments ra ON ra.id = sw.requester_assignment_id
  LEFT JOIN shift_assignments ta ON ta.id = sw.target_assignment_id
  INNER JOIN employees er ON er.id = sw.requester_employee_id
  INNER JOIN employees et ON et.id = sw.target_employee_id`

async function getSwap(id: string) {
  const rows = await unsafe<Record<string, unknown>>(`${SWAP_SELECT} WHERE sw.id = $1 LIMIT 1`, [id])
  return normalizeSwapRow(rows[0] ?? null)
}

async function getAssignment(id: string) {
  const db = getDb()
  const rows = await db`SELECT * FROM shift_assignments WHERE id = ${id} LIMIT 1`
  return rows[0] ?? null
}

export async function listSwaps(employeeId?: string | null, hrView = false) {
  if (hrView) {
    const rows = await unsafe<Record<string, unknown>>(`${SWAP_SELECT} ORDER BY sw.created_at DESC LIMIT 100`)
    return rows.map((r) => normalizeSwapRow(r))
  }
  if (!employeeId) return []
  const rows = await unsafe<Record<string, unknown>>(
    `${SWAP_SELECT} WHERE sw.requester_employee_id = $1 OR sw.target_employee_id = $2 ORDER BY sw.created_at DESC LIMIT 100`,
    [employeeId, employeeId],
  )
  return rows.map((r) => normalizeSwapRow(r))
}

export async function createSwap(data: Record<string, unknown>, userId: string, requesterEmployeeId: string) {
  const assignmentId = String(data.requester_assignment_id ?? '')
  const targetEmployeeId = String(data.target_employee_id ?? '')
  if (!assignmentId || !targetEmployeeId) throw new ValidationError('requester_assignment_id and target_employee_id required')
  if (targetEmployeeId === requesterEmployeeId) throw new ValidationError('Cannot swap with yourself')
  const assignment = await getAssignment(assignmentId)
  if (!assignment || String(assignment.employee_id) !== requesterEmployeeId) {
    throw new ValidationError('Shift assignment not found')
  }
  if (normalizeCalendarDate(assignment.shift_date) < todayInBranchTz()) {
    throw new ValidationError('Cannot swap past shifts')
  }
  const db = getDb()
  const [target, requester] = await Promise.all([
    db`SELECT branch_id FROM employees WHERE id = ${targetEmployeeId} LIMIT 1`,
    db`SELECT branch_id FROM employees WHERE id = ${requesterEmployeeId} LIMIT 1`,
  ])
  if (!target[0] || !requester[0] || target[0].branch_id !== requester[0].branch_id) {
    throw new ValidationError('Coworker must be in your branch')
  }

  // For a mutual exchange, the target shift must belong to the target coworker
  // and fall on the same day as the requester's shift (the documented rule).
  let targetAssignmentId: string | null = null
  if (data.target_assignment_id) {
    targetAssignmentId = String(data.target_assignment_id)
    const targetAssignment = await getAssignment(targetAssignmentId)
    if (!targetAssignment || String(targetAssignment.employee_id) !== targetEmployeeId) {
      throw new ValidationError('Target shift does not belong to that coworker')
    }
    if (normalizeCalendarDate(targetAssignment.shift_date) !== normalizeCalendarDate(assignment.shift_date)) {
      throw new ValidationError('Shift exchanges must be on the same day')
    }
  }

  const [row] = await db`
    INSERT INTO shift_swap_requests (requester_assignment_id, requester_employee_id, target_employee_id,
      target_assignment_id, message, created_by_user_id)
    VALUES (${assignmentId}, ${requesterEmployeeId}, ${targetEmployeeId},
      ${targetAssignmentId},
      ${data.message ? String(data.message) : null}, ${userId})
    RETURNING id
  `
  return getSwap(String(row.id))
}

async function executeSwap(swap: Record<string, unknown>, tx: TransactionSql) {
  const reqAssign = await getAssignment(String(swap.requester_assignment_id))
  if (!reqAssign) throw new Error('Assignment missing')
  if (swap.target_assignment_id) {
    const tgtAssign = await getAssignment(String(swap.target_assignment_id))
    if (!tgtAssign) throw new Error('Target assignment missing')
    await tx`UPDATE shift_assignments SET employee_id = ${String(swap.target_employee_id)} WHERE id = ${String(reqAssign.id)}`
    await tx`UPDATE shift_assignments SET employee_id = ${String(swap.requester_employee_id)} WHERE id = ${String(tgtAssign.id)}`
  } else {
    await tx`UPDATE shift_assignments SET employee_id = ${String(swap.target_employee_id)} WHERE id = ${String(reqAssign.id)}`
  }
}

export async function respondSwap(id: string, action: string, responderEmployeeId: string) {
  if (!['accept', 'reject'].includes(action)) throw new ValidationError('action must be accept or reject')
  const swap = await getSwap(id)
  if (!swap || swap.status !== 'pending') return null
  if (String(swap.target_employee_id) !== responderEmployeeId) {
    throw new ValidationError('Only the requested coworker can respond')
  }
  const db = getDb()
  if (action === 'reject') {
    await db`UPDATE shift_swap_requests SET status = 'rejected', responded_at = NOW() WHERE id = ${id}`
    return getSwap(id)
  }
  await db.begin(async (tx) => {
    await executeSwap(swap, tx)
    await tx`UPDATE shift_swap_requests SET status = 'accepted', responded_at = NOW() WHERE id = ${id}`
  })
  return getSwap(id)
}

export async function cancelSwap(id: string, employeeId: string) {
  const db = getDb()
  const result = await db`
    UPDATE shift_swap_requests SET status = 'cancelled', responded_at = NOW()
    WHERE id = ${id} AND requester_employee_id = ${employeeId} AND status = 'pending'
  `
  return result.count > 0
}
