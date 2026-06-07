import { api, ApiError } from './api'
import { evaluateClockGeofence } from './clockGeofence'
import { getCurrentPositionDetailed, geoErrorMessage, type GeoCoords } from './geolocation'
import { reverseGeocode } from './geocode'

export type ShiftClockContext = {
  has_shift?: boolean
  shift_label?: string | null
  shift_start?: string
  shift_end?: string
  shift_end_at?: string | null
  expected_shift_end_at?: string | null
  expected_shift_end?: string | null
  late_minutes?: number
  early_minutes?: number
  minutes_until_end?: number | null
  phase?: 'normal' | 'ending_soon' | 'overdue'
  show_end_shift?: boolean
  can_auto_clock_out_outside?: boolean
  hours_worked?: number
  hours_from_scheduled_start?: number
}

export type ClockStatus = {
  open: boolean
  on_break?: boolean
  geofence_required?: boolean
  mobile_clock?: boolean
  position_label?: string | null
  shift?: ShiftClockContext | null
}

export async function fetchClockStatus(): Promise<ClockStatus> {
  return api<ClockStatus>('/attendance/status')
}

async function addressForCoords(coords: GeoCoords): Promise<string | null> {
  try {
    return (await reverseGeocode(coords.latitude, coords.longitude)).short
  } catch {
    return null
  }
}

async function resolveCoords(requireLocation: boolean): Promise<GeoCoords | null> {
  const geo = await getCurrentPositionDetailed()
  if (!geo.ok) {
    if (requireLocation) throw new Error(geoErrorMessage(geo.code))
    return null
  }
  return geo.coords
}

async function postClock(
  action: 'clock-in' | 'clock-out',
  coords: GeoCoords | null,
  address: string | null
): Promise<void> {
  const body: Record<string, unknown> = {}
  if (coords) {
    body.latitude = coords.latitude
    body.longitude = coords.longitude
    if (coords.accuracyM != null && coords.accuracyM > 0) {
      body.accuracy_m = coords.accuracyM
    }
  }
  if (address) body.address = address
  await api(`/attendance/${action}`, { method: 'POST', body: JSON.stringify(body) })
}

/** Clock in with one GPS read and client-side zone check when geofence is required. */
export async function clockIn(geofenceRequired = false): Promise<void> {
  if (geofenceRequired) {
    const snap = await evaluateClockGeofence(true)
    if (snap.locationDenied) {
      throw new Error(
        snap.locationError
          ? geoErrorMessage(snap.locationError)
          : 'Location is required to clock in. Tap Enable location first.'
      )
    }
    if (!snap.inside || !snap.coords) {
      const hint = snap.nearestSiteName && snap.nearestDistanceM != null
        ? ` Nearest zone: ${snap.nearestSiteName} (${Math.round(snap.nearestDistanceM)} m away).`
        : ''
      throw new Error(
        `You must be at the registered branch to clock in (delivery included).${hint}`
      )
    }
    const address = await addressForCoords(snap.coords)
    await postClock('clock-in', snap.coords, address)
    return
  }

  const coords = await resolveCoords(false)
  const address = coords ? await addressForCoords(coords) : null
  await postClock('clock-in', coords, address)
}

export async function clockOut(): Promise<void> {
  const coords = await resolveCoords(false)
  const address = coords ? await addressForCoords(coords) : null
  await postClock('clock-out', coords, address)
}

export function clockErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Session expired — please sign in again.'
    if (err.status === 403) return 'You are not allowed to use the time clock.'
    if (err.status === 422) return err.message || 'Could not complete clock action.'
    return err.message
  }
  if (err instanceof Error && err.message) return err.message
  return 'Clock action failed. Check your connection and try again.'
}
