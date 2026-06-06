export type GeofenceSite = {
  id: string
  name: string
  latitude: string | number
  longitude: string | number
  radius_m: number
}

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Nearest active site whose circle contains the point, or null if outside all zones. */
export function matchGeofenceSite(
  lat: number,
  lng: number,
  sites: GeofenceSite[]
): { site: GeofenceSite; distanceM: number } | null {
  let best: { site: GeofenceSite; distanceM: number } | null = null
  for (const site of sites) {
    const dist = distanceMeters(lat, lng, Number(site.latitude), Number(site.longitude))
    const radius = Number(site.radius_m) || 150
    if (dist <= radius && (!best || dist < best.distanceM)) {
      best = { site, distanceM: dist }
    }
  }
  return best
}

export type GeofenceCircle = {
  id: string
  lat: number
  lng: number
  radiusM: number
  label?: string
}
