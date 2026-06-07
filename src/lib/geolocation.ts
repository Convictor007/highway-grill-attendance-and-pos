export type GeoCoords = { latitude: number; longitude: number; accuracyM?: number }

export type GeoErrorCode =
  | 'unsupported'
  | 'insecure'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'unknown'

export type GeoResult =
  | { ok: true; coords: GeoCoords }
  | { ok: false; code: GeoErrorCode }

function mapGeoError(code: number): GeoErrorCode {
  switch (code) {
    case 1:
      return 'denied'
    case 2:
      return 'unavailable'
    case 3:
      return 'timeout'
    default:
      return 'unknown'
  }
}

export function isSecureGeoContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext
}

export function geoErrorMessage(code: GeoErrorCode): string {
  switch (code) {
    case 'insecure':
      return 'Location only works over HTTPS. Use an HTTPS link (e.g. ngrok) or localhost — not http://192.168.x.x.'
    case 'denied':
      return 'Location is blocked. Tap Enable location below, or allow it in your browser site settings.'
    case 'unavailable':
      return 'GPS is unavailable. Turn on Location in Android settings and try again.'
    case 'timeout':
      return 'Location timed out. Move outdoors or nearer a window, then try again.'
    case 'unsupported':
      return 'This browser does not support location.'
    default:
      return 'Could not read your location. Try again.'
  }
}

export function getCurrentPositionDetailed(options?: { maximumAge?: number }): Promise<GeoResult> {
  const maximumAge = options?.maximumAge ?? 0
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ ok: false, code: 'unsupported' })
      return
    }
    if (!isSecureGeoContext()) {
      resolve({ ok: false, code: 'insecure' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          ok: true,
          coords: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyM:
              typeof pos.coords.accuracy === 'number' && pos.coords.accuracy > 0
                ? pos.coords.accuracy
                : undefined,
          },
        }),
      (err) => resolve({ ok: false, code: mapGeoError(err.code) }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge }
    )
  })
}

export async function getCurrentPosition(): Promise<GeoCoords | null> {
  const result = await getCurrentPositionDetailed()
  return result.ok ? result.coords : null
}

/** Live GPS updates while active; call the returned stop() when done. */
export function watchPosition(
  onUpdate: (coords: GeoCoords) => void,
  onError?: (code: GeoErrorCode) => void
): () => void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onError?.('unsupported')
    return () => {}
  }
  if (!isSecureGeoContext()) {
    onError?.('insecure')
    return () => {}
  }

  const id = navigator.geolocation.watchPosition(
    (pos) =>
      onUpdate({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracyM:
          typeof pos.coords.accuracy === 'number' && pos.coords.accuracy > 0
            ? pos.coords.accuracy
            : undefined,
      }),
    (err) => onError?.(mapGeoError(err.code)),
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
  )

  return () => navigator.geolocation.clearWatch(id)
}
