import { getCurrentPositionDetailed, type GeoCoords, type GeoErrorCode } from './geolocation'
import { fetchZoneStatus } from './fieldWork'

export type ClockGeofenceSnapshot = {
  inside: boolean
  siteName: string | null
  locationDenied: boolean
  locationError: GeoErrorCode | null
  nearestSiteName: string | null
  nearestDistanceM: number | null
  coords: GeoCoords | null
}

const emptySnapshot = (overrides: Partial<ClockGeofenceSnapshot> = {}): ClockGeofenceSnapshot => ({
  inside: false,
  siteName: null,
  locationDenied: false,
  locationError: null,
  nearestSiteName: null,
  nearestDistanceM: null,
  coords: null,
  ...overrides,
})

export async function evaluateZoneAtCoords(coords: GeoCoords): Promise<ClockGeofenceSnapshot> {
  const zone = await fetchZoneStatus(coords.latitude, coords.longitude, {
    clockInOnly: true,
    accuracyM: coords.accuracyM,
  })
  return {
    inside: zone.inside,
    siteName: zone.site?.name ?? null,
    locationDenied: false,
    locationError: null,
    nearestSiteName: zone.nearest_site?.name ?? null,
    nearestDistanceM: zone.nearest_distance_m ?? null,
    coords,
  }
}

export async function evaluateClockGeofence(geofenceRequired: boolean): Promise<ClockGeofenceSnapshot> {
  if (!geofenceRequired) {
    return emptySnapshot({ inside: true })
  }

  const geo = await getCurrentPositionDetailed()
  if (!geo.ok) {
    return emptySnapshot({ locationDenied: true, locationError: geo.code })
  }

  const zone = await fetchZoneStatus(geo.coords.latitude, geo.coords.longitude, {
    clockInOnly: true,
    accuracyM: geo.coords.accuracyM,
  })
  return {
    inside: zone.inside,
    siteName: zone.site?.name ?? null,
    locationDenied: false,
    locationError: null,
    nearestSiteName: zone.nearest_site?.name ?? null,
    nearestDistanceM: zone.nearest_distance_m ?? null,
    coords: geo.coords,
  }
}
