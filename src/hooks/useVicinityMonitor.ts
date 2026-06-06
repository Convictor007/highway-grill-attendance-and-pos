import { useCallback, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { getCurrentPosition } from '../lib/geolocation'

type VicinityPingResult = {
  auto_clocked_out: boolean
  session: unknown
}

type Options = {
  enabled: boolean
  geofenceRequired: boolean
  intervalMs?: number
  onAutoClockOut?: () => void
}

export function useVicinityMonitor({
  enabled,
  geofenceRequired,
  intervalMs = 60_000,
  onAutoClockOut,
}: Options) {
  const onAutoRef = useRef(onAutoClockOut)
  onAutoRef.current = onAutoClockOut

  const ping = useCallback(async () => {
    const coords = await getCurrentPosition()
    if (!coords) return
    try {
      const result = await api<VicinityPingResult>('/attendance/vicinity-ping', {
        method: 'POST',
        body: JSON.stringify({
          latitude: coords.latitude,
          longitude: coords.longitude,
        }),
      })
      if (result.auto_clocked_out) {
        onAutoRef.current?.()
      }
    } catch {
      // ignore transient GPS/API errors; next ping retries
    }
  }, [])

  useEffect(() => {
    if (!enabled || !geofenceRequired) return
    ping()
    const id = window.setInterval(ping, intervalMs)
    return () => window.clearInterval(id)
  }, [enabled, geofenceRequired, intervalMs, ping])
}
