export type GeoCoords = { latitude: number; longitude: number }

export function getCurrentPosition(): Promise<GeoCoords | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  })
}

export function clockBody(coords: GeoCoords | null): string {
  if (!coords) return '{}'
  return JSON.stringify(coords)
}
