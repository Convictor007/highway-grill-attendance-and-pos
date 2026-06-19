export const MAX_REGULAR_HOURS = 9
const GRACE_MS = 60_000

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

function parseTs(iso: string): number {
  return new Date(iso.replace(' ', 'T')).getTime()
}

function shiftTimestamp(date: string, time: string): number {
  return parseTs(`${date}T${time.slice(0, 8)}`)
}

function shiftEndTimestamp(date: string, startTime: string, endTime: string): number {
  const startTs = shiftTimestamp(date, startTime)
  let endTs = shiftTimestamp(date, endTime)
  if (endTs <= startTs) {
    endTs += 24 * 60 * 60 * 1000
  }
  return endTs
}

export function workedHours(clockIn: string, clockOut: string, record: Record<string, unknown>): number {
  let minutes = Math.round((parseTs(clockOut) - parseTs(clockIn)) / 60_000)
  if (record.break_start && record.break_end) {
    const breakMins = Math.round(
      (parseTs(String(record.break_end)) - parseTs(String(record.break_start))) / 60_000,
    )
    minutes = Math.max(0, minutes - breakMins)
  }
  return Math.round((minutes / 60) * 100) / 100
}

export function resolveShiftTiming(record: Record<string, unknown>, shift: ShiftAssignment | null): ShiftTiming {
  const clockInTs = parseTs(String(record.clock_in))
  const clockOutRaw = record.clock_out ? String(record.clock_out) : ''
  const clockOutTs = clockOutRaw ? parseTs(clockOutRaw) : null
  const nineHourEndTs = clockInTs + MAX_REGULAR_HOURS * 3_600_000

  let scheduledStartTs: number | null = null
  let scheduledEndTs: number | null = null
  if (shift?.shift_date && shift.start_time && shift.end_time) {
    scheduledStartTs = shiftTimestamp(String(shift.shift_date).slice(0, 10), String(shift.start_time))
    scheduledEndTs = shiftEndTimestamp(
      String(shift.shift_date).slice(0, 10),
      String(shift.start_time),
      String(shift.end_time),
    )
  }

  let expectedEndTs: number | null = nineHourEndTs
  if (scheduledEndTs != null) {
    expectedEndTs = Math.max(scheduledEndTs, nineHourEndTs)
  }

  const hasShift = scheduledStartTs != null
  let earlyIn: number | null = null
  let lateIn: number | null = null
  let earlyOut: number | null = null
  let lateOut: number | null = null

  if (hasShift && scheduledStartTs != null) {
    if (clockInTs > scheduledStartTs + GRACE_MS) {
      lateIn = Math.round((clockInTs - scheduledStartTs) / 60_000)
    } else if (clockInTs < scheduledStartTs - GRACE_MS) {
      earlyIn = Math.round((scheduledStartTs - clockInTs) / 60_000)
    } else {
      earlyIn = 0
      lateIn = 0
    }
  }

  if (hasShift && scheduledEndTs != null && clockOutTs != null) {
    if (clockOutTs < scheduledEndTs - GRACE_MS) {
      earlyOut = Math.round((scheduledEndTs - clockOutTs) / 60_000)
    } else if (clockOutTs > scheduledEndTs + GRACE_MS) {
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

function expectedRegularEndTimestamp(record: Record<string, unknown>, shift: ShiftAssignment | null): number | null {
  const clockInTs = parseTs(String(record.clock_in))
  const nineHourEndTs = clockInTs + MAX_REGULAR_HOURS * 3_600_000
  if (!shift?.shift_date || !shift.end_time) return nineHourEndTs
  const scheduledEndTs = shiftEndTimestamp(
    String(shift.shift_date).slice(0, 10),
    String(shift.start_time ?? '00:00:00'),
    String(shift.end_time),
  )
  return Math.max(scheduledEndTs, nineHourEndTs)
}

function isPastMidnight(clockIn: string, clockOut: string): boolean {
  const shiftDate = clockIn.slice(0, 10)
  const midnight = parseTs(`${shiftDate}T00:00:00`) + 24 * 60 * 60 * 1000
  return parseTs(clockOut) >= midnight
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
  if (isPastMidnight(clockIn, clockOut)) reasons.push('Past midnight')
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

  const worked =
    record.actual_hours != null ? Number(record.actual_hours) : workedHours(clockIn, clockOut, record)
  const earlyIn = timing.early_in_minutes ?? 0
  const earlyHours = Math.round((earlyIn / 60) * 100) / 100
  const payableWorked = Math.round(Math.max(0, worked - earlyHours) * 100) / 100

  const clockInTs = parseTs(clockIn)
  const clockOutTs = parseTs(clockOut)
  const expectedEndTs = expectedRegularEndTimestamp(record, shift)

  if (expectedEndTs == null) {
    const regular = Math.round(Math.min(payableWorked, MAX_REGULAR_HOURS) * 100) / 100
    const overtime = Math.round(Math.max(0, payableWorked - regular) * 100) / 100
    return {
      worked,
      regular,
      overtime,
      reason: overtimeReasons(record, clockIn, clockOut, payableWorked, overtime, timing, expectedEndTs),
      timing,
    }
  }

  let dutyStart = clockIn
  if (earlyIn > 0 && timing.scheduled_start_ts != null) {
    dutyStart = new Date(timing.scheduled_start_ts).toISOString().replace('T', ' ').slice(0, 19)
  }

  const regularEndTs = Math.min(clockOutTs, expectedEndTs)
  const regularFromWindow = workedHours(
    dutyStart,
    new Date(regularEndTs).toISOString().replace('T', ' ').slice(0, 19),
    record,
  )
  const regular = Math.round(Math.min(regularFromWindow, MAX_REGULAR_HOURS, payableWorked) * 100) / 100
  const overtime = Math.round(Math.max(0, payableWorked - regular) * 100) / 100

  return {
    worked,
    regular,
    overtime,
    reason: overtimeReasons(record, clockIn, clockOut, payableWorked, overtime, timing, expectedEndTs),
    timing,
  }
}

export function timingToDbColumns(timing: ShiftTiming) {
  return {
    early_in_minutes: timing.early_in_minutes,
    late_in_minutes: timing.late_in_minutes,
    early_out_minutes: timing.early_out_minutes,
    late_out_minutes: null,
  }
}
