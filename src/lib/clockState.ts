import type { AttendanceRecord } from '../types/hrms'
import type { ClockStatus } from './clock'

/** When status fails or returns open=false, infer open session from history. */
export function resolveClockOpenState(
  status: ClockStatus,
  history: AttendanceRecord[],
): { open: boolean; onBreak: boolean } {
  const openFromHistory = history.find((r) => !r.clock_out) ?? null
  const open = status.open || Boolean(openFromHistory)
  return {
    open,
    onBreak: open ? !!status.on_break : false,
  }
}
