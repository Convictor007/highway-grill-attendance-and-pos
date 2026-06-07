import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { getCurrentPositionDetailed, isSecureGeoContext, type GeoCoords } from '../lib/geolocation'
import type { VicinityPingResult, VicinityStatus } from '../lib/vicinity'

type Options = {
  enabled: boolean
  geofenceRequired: boolean
  intervalMs?: number
  outsideIntervalMs?: number
  onAutoClockOut?: () => void
  /** Reuse the same GPS fix for zone UI (avoids duplicate reads). */
  onLocationPing?: (coords: GeoCoords) => void
}

export function useVicinityMonitor({
  enabled,
  geofenceRequired,
  intervalMs = 60_000,
  outsideIntervalMs = 30_000,
  onAutoClockOut,
  onLocationPing,
}: Options) {
  const onAutoRef = useRef(onAutoClockOut)
  const onPingRef = useRef(onLocationPing)
  onAutoRef.current = onAutoClockOut
  onPingRef.current = onLocationPing
  const outsideRef = useRef(false)

  const [vicinity, setVicinity] = useState<VicinityStatus | null>(null)

  const ping = useCallback(async () => {
    if (!isSecureGeoContext()) return
    const geo = await getCurrentPositionDetailed({ maximumAge: 90_000 })
    if (!geo.ok) return
    onPingRef.current?.(geo.coords)
    try {
      const result = await api<VicinityPingResult>('/attendance/vicinity-ping', {
        method: 'POST',
        body: JSON.stringify({
          latitude: geo.coords.latitude,
          longitude: geo.coords.longitude,
          ...(geo.coords.accuracyM != null && geo.coords.accuracyM > 0
            ? { accuracy_m: geo.coords.accuracyM }
            : {}),
        }),
      })
      if (result.vicinity) {
        setVicinity(result.vicinity)
        outsideRef.current = !result.vicinity.inside
      }
      if (result.auto_clocked_out) {
        setVicinity(null)
        outsideRef.current = false
        onAutoRef.current?.()
      }
    } catch {
      // retry on next interval
    }
  }, [])

  useEffect(() => {
    if (!enabled || !geofenceRequired) {
      setVicinity(null)
      outsideRef.current = false
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const schedule = () => {
      const delay = outsideRef.current ? outsideIntervalMs : intervalMs
      timer = setTimeout(async () => {
        if (cancelled) return
        await ping()
        if (!cancelled) schedule()
      }, delay)
    }

    void ping().finally(() => {
      if (!cancelled) schedule()
    })

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [enabled, geofenceRequired, intervalMs, outsideIntervalMs, ping])

  return vicinity
}
