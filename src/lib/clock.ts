import { api } from './api'
import { getCurrentPosition, type GeoCoords } from './geolocation'
import { reverseGeocode } from './geocode'
import { ApiError } from './api'

export type ShiftClockContext = {
  has_shift?: boolean
  shift_label?: string | null
  shift_start?: string
  shift_end?: string
  shift_end_at?: string | null
  minutes_until_end?: number | null
  phase?: 'normal' | 'ending_soon' | 'overdue'
  show_end_shift?: boolean
  can_auto_clock_out_outside?: boolean
  hours_from_scheduled_start?: number
}

export type ClockStatus = {
  open: boolean
  on_break?: boolean
  geofence_required?: boolean
  shift?: ShiftClockContext | null
}

export async function fetchClockStatus(): Promise<ClockStatus> {
  return api<ClockStatus>('/attendance/status')
}

async function coordsWithAddress(): Promise<{ coords: GeoCoords | null; address: string | null }> {
  const coords = await getCurrentPosition()
  if (!coords) return { coords: null, address: null }
  try {
    const geo = await reverseGeocode(coords.latitude, coords.longitude)
    return { coords, address: geo.short }
  } catch {
    return { coords, address: null }
  }
}

export async function clockIn(): Promise<void> {
  const { coords, address } = await coordsWithAddress()
  const body: Record<string, unknown> = {}
  if (coords) {
    body.latitude = coords.latitude
    body.longitude = coords.longitude
  }
  if (address) body.address = address
  await api('/attendance/clock-in', { method: 'POST', body: JSON.stringify(body) })
}

export async function clockOut(): Promise<void> {
  const { coords, address } = await coordsWithAddress()
  const body: Record<string, unknown> = {}
  if (coords) {
    body.latitude = coords.latitude
    body.longitude = coords.longitude
  }
  if (address) body.address = address
  await api('/attendance/clock-out', { method: 'POST', body: JSON.stringify(body) })
}

export function clockErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Session expired — please sign in again.'
    if (err.status === 403) return 'You are not allowed to use the time clock.'
    if (err.status === 422) return err.message || 'Your account is not linked to an employee record.'
    return err.message
  }
  return 'Clock action failed. Check your connection and try again.'
}
