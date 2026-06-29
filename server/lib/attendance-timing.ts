import {
  crossedBranchMidnight,
  normalizeCalendarDate,
  parseClockInstant,
  shiftWallClockToUtcMs,
} from './branch-time'

export const MAX_REGULAR_HOURS = 9
/** Automatic unpaid meal break deducted from regular hours when duty is long enough. */
export const UNPAID_BREAK_HOURS = 1
/** Days with regular duty below this threshold keep full hours (no auto break). */
export const BREAK_EXEMPT_BELOW_HOURS = 4

const MINUTE_MS = 60_000
/** Clock in up to this early = on time (no "early in"); pay still starts at shift start. */
export const EARLY_IN_GRACE_MS = 15 * MINUTE_MS
/** Clock in within this window after start = on time (not late). */
export const LATE_IN_GRACE_MS = 5 * MINUTE_MS
/** Clock out within this window before end = on time (full shift, no "early out"). */
export const EARLY_OUT_GRACE_MS = 10 * MINUTE_MS
/** Overtime only starts once clock out is this far past the scheduled end. */
export const LATE_OUT_GRACE_MS = 5 * MINUTE_MS

export type ShiftAssignment = {
  shift_date: string
  start_time: string
  end_time: string
}

export type ShiftTiming = {
  expected_end_ts: number | null
  scheduled_end_ts: number | null
  scheduled_start_ts: number | null
  early_in_minutes: number | null
  late_in_minutes: number | null
  early_out_minutes: number | null
  late_out_minutes: number | null
}

export type HourSplit = {
  worked: number
  regular: number
  overtime: number
  reason: string
  timing: ShiftTiming
}

function parseTs(value: unknown): number {
  return parseClockInstant(value)
}

function normalizeDate(value: unknown): string {
  return normalizeCalendarDate(value)
}

function normalizeTime(value: unknown): string {
  return String(value ?? '').slice(0, 8)
}

function shiftTimestamp(date: string, time: string): number {
  return shiftWallClockToUtcMs(normalizeDate(date), normalizeTime(time))
}

function tsToDbString(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19)
}

/** Regular duty starts at scheduled shift start unless the employee was late. */
export function effectiveDutyStartTs(timing: ShiftTiming, clockInTs: number): number {
  if (timing.scheduled_start_ts != null && (timing.late_in_minutes ?? 0) <= 0) {
    return timing.scheduled_start_ts
  }
  return clockInTs
}

function shiftEndTimestamp(date: string, startTime: string, endTime: string): number {
  const startTs = shiftTimestamp(date, startTime)
  let endTs = shiftTimestamp(date, endTime)
  if (endTs <= startTs) {
    endTs += 24 * 60 * 60 * 1000
  }
  return endTs
}

function explicitBreakHours(record: Record<string, unknown>): number {
  if (record.break_start && record.break_end) {
    const breakMins = Math.round(
      (parseTs(record.break_end) - parseTs(record.break_start)) / 60_000,
    )
    return Math.round((Math.max(0, breakMins) / 60) * 100) / 100
  }
  return 0
}

/** Deduct automatic unpaid break from regular hours only (never overtime). */
export function applyUnpaidBreakToRegular(
  regular: number,
  record: Record<string, unknown>,
): { regular: number; breakDeducted: number } {
  if (regular < BREAK_EXEMPT_BELOW_HOURS) {
    return { regular, breakDeducted: 0 }
  }
  const autoBreak = Math.max(0, UNPAID_BREAK_HOURS - explicitBreakHours(record))
  const breakDeducted = Math.round(autoBreak * 100) / 100
  const netRegular = Math.max(0, Math.round((regular - breakDeducted) * 100) / 100)
  return { regular: netRegular, breakDeducted }
}

export function workedHours(clockIn: unknown, clockOut: unknown, record: Record<string, unknown>): number {
  let minutes = Math.round((parseTs(clockOut) - parseTs(clockIn)) / 60_000)
  if (record.break_start && record.break_end) {
    const breakMins = Math.round(
      (parseTs(record.break_end) - parseTs(record.break_start)) / 60_000,
    )
    minutes = Math.max(0, minutes - breakMins)
  }
  return Math.round((minutes / 60) * 100) / 100
}

export function resolveShiftTiming(record: Record<string, unknown>, shift: ShiftAssignment | null): ShiftTiming {
  const clockInTs = parseTs(record.clock_in)
  const clockOutRaw = record.clock_out
  const clockOutTs = clockOutRaw != null && clockOutRaw !== '' ? parseTs(clockOutRaw) : null
  const nineHourEndTs = clockInTs + MAX_REGULAR_HOURS * 3_600_000

  let scheduledStartTs: number | null = null
  let scheduledEndTs: number | null = null
  if (shift?.shift_date && shift.start_time && shift.end_time) {
    scheduledStartTs = shiftTimestamp(normalizeDate(shift.shift_date), normalizeTime(shift.start_time))
    scheduledEndTs = shiftEndTimestamp(
      normalizeDate(shift.shift_date),
      normalizeTime(shift.start_time),
      normalizeTime(shift.end_time),
    )
  }

  let expectedEndTs: number | null = nineHourEndTs
  if (scheduledEndTs != null) {
    expectedEndTs = scheduledEndTs
  }

  const hasShift = scheduledStartTs != null
  let earlyIn: number | null = null
  let lateIn: number | null = null
  let earlyOut: number | null = null
  let lateOut: number | null = null

  if (hasShift && scheduledStartTs != null) {
    if (clockInTs > scheduledStartTs + LATE_IN_GRACE_MS) {
      lateIn = Math.round((clockInTs - scheduledStartTs) / 60_000)
    } else if (clockInTs < scheduledStartTs - EARLY_IN_GRACE_MS) {
      earlyIn = Math.round((scheduledStartTs - clockInTs) / 60_000)
    } else {
      earlyIn = 0
      lateIn = 0
    }
  }

  if (hasShift && scheduledEndTs != null && clockOutTs != null) {
    if (clockOutTs < scheduledEndTs - EARLY_OUT_GRACE_MS) {
      earlyOut = Math.round((scheduledEndTs - clockOutTs) / 60_000)
    } else if (clockOutTs > scheduledEndTs + LATE_OUT_GRACE_MS) {
      lateOut = Math.round((clockOutTs - scheduledEndTs) / 60_000)
    } else {
      earlyOut = 0
      lateOut = 0
    }
  }

  return {
    expected_end_ts: expectedEndTs,
    scheduled_end_ts: scheduledEndTs,
    scheduled_start_ts: scheduledStartTs,
    early_in_minutes: earlyIn,
    late_in_minutes: lateIn,
    early_out_minutes: earlyOut,
    late_out_minutes: lateOut,
  }
}

function overtimeReasons(
  record: Record<string, unknown>,
  clockIn: string,
  clockOut: string,
  payableWorked: number,
  overtime: number,
  timing: ShiftTiming,
  expectedEndTs: number | null,
): string {
  if (overtime <= 0) return ''
  const reasons: string[] = []
  const clockInTs = parseTs(clockIn)
  const clockOutTs = parseTs(clockOut)
  const lateIn = timing.late_in_minutes ?? 0

  if (lateIn > 0 && expectedEndTs != null) {
    const nineHourEndTs = clockInTs + MAX_REGULAR_HOURS * 3_600_000
    if (expectedEndTs === nineHourEndTs && clockOutTs > nineHourEndTs) {
      reasons.push('Past 9h after late clock-in')
    }
  }
  if (timing.scheduled_end_ts != null && clockOutTs > timing.scheduled_end_ts) {
    if (lateIn === 0 || clockOutTs > (expectedEndTs ?? 0)) {
      reasons.push('Past scheduled shift end')
    }
  }
  if (crossedBranchMidnight(clockIn, clockOut)) reasons.push('Past midnight')
  if (payableWorked > MAX_REGULAR_HOURS) {
    reasons.push(`Exceeded ${MAX_REGULAR_HOURS}h regular duty`)
  }
  return reasons.length > 0 ? [...new Set(reasons)].join('; ') : 'Auto-detected from DTR'
}

export function computeHourSplit(record: Record<string, unknown>, shift: ShiftAssignment | null): HourSplit {
  const clockIn = String(record.clock_in)
  const clockOut = record.clock_out ? String(record.clock_out) : ''
  const timing = resolveShiftTiming(record, shift)

  if (!clockOut) {
    return { worked: 0, regular: 0, overtime: 0, reason: '', timing }
  }

  const clockInTs = parseTs(clockIn)
  const clockOutTs = parseTs(clockOut)

  // Hours follow the registered schedule when a shift is assigned.
  if (
    shift?.shift_date &&
    shift.start_time &&
    shift.end_time &&
    timing.scheduled_start_ts != null &&
    timing.scheduled_end_ts != null
  ) {
    const dutyStartTs = effectiveDutyStartTs(timing, clockInTs)
    const scheduledEndTs = timing.scheduled_end_ts
    // Leaving within the early-out grace counts as the full scheduled shift.
    const regularEndTs =
      clockOutTs >= scheduledEndTs - EARLY_OUT_GRACE_MS
        ? scheduledEndTs
        : clockOutTs

    let regular = 0
    if (regularEndTs > dutyStartTs) {
      regular = workedHours(tsToDbString(dutyStartTs), tsToDbString(regularEndTs), record)
    }
    regular = Math.round(Math.min(regular, MAX_REGULAR_HOURS) * 100) / 100

    let overtime = 0
    if (clockOutTs > scheduledEndTs + LATE_OUT_GRACE_MS) {
      overtime = workedHours(tsToDbString(scheduledEndTs), clockOut, record)
    }
    overtime = Math.round(overtime * 100) / 100

    const breakApplied = applyUnpaidBreakToRegular(regular, record)
    regular = breakApplied.regular
    const worked = Math.round((regular + overtime) * 100) / 100

    return {
      worked,
      regular,
      overtime,
      reason: overtimeReasons(record, clockIn, clockOut, worked, overtime, timing, scheduledEndTs),
      timing,
    }
  }

  // No schedule: use actual elapsed time capped at 9 regular hours.
  const workedRaw = workedHours(clockIn, clockOut, record)
  const regularPre = Math.round(Math.min(workedRaw, MAX_REGULAR_HOURS) * 100) / 100
  const overtime = Math.round(Math.max(0, workedRaw - regularPre) * 100) / 100
  const breakApplied = applyUnpaidBreakToRegular(regularPre, record)
  const regular = breakApplied.regular
  const worked = Math.round((regular + overtime) * 100) / 100
  const expectedEndTs = clockInTs + MAX_REGULAR_HOURS * 3_600_000

  return {
    worked,
    regular,
    overtime,
    reason: overtimeReasons(record, clockIn, clockOut, worked, overtime, timing, expectedEndTs),
    timing,
  }
}

export function timingToDbColumns(timing: ShiftTiming) {
  return {
    early_in_minutes: timing.early_in_minutes,
    late_in_minutes: timing.late_in_minutes,
    early_out_minutes: timing.early_out_minutes,
    late_out_minutes: timing.late_out_minutes,
  }
}
