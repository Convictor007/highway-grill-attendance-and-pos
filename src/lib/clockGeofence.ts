import { getCurrentPosition } from './geolocation'
import { fetchZoneStatus } from './fieldWork'

export type ClockGeofenceSnapshot = {
  inside: boolean
  siteName: string | null
  locationDenied: boolean
}

export async function evaluateClockGeofence(geofenceRequired: boolean): Promise<ClockGeofenceSnapshot> {
  if (!geofenceRequired) {
    return { inside: true, siteName: null, locationDenied: false }
  }

  const coords = await getCurrentPosition()
  if (!coords) {
    return { inside: false, siteName: null, locationDenied: true }
  }

  const zone = await fetchZoneStatus(coords.latitude, coords.longitude)
  return {
    inside: zone.inside,
    siteName: zone.site?.name ?? null,
    locationDenied: false,
  }
}
