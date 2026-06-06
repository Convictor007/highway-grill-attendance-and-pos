import { useCallback, useEffect, useState } from 'react'
import { evaluateClockGeofence } from '../lib/clockGeofence'

export function useClockGeofence(geofenceRequired: boolean) {
  const [loading, setLoading] = useState(false)
  const [inside, setInside] = useState<boolean | null>(null)
  const [siteName, setSiteName] = useState<string | null>(null)
  const [locationDenied, setLocationDenied] = useState(false)

  const refresh = useCallback(async () => {
    if (!geofenceRequired) {
      setInside(true)
      setSiteName(null)
      setLocationDenied(false)
      return
    }

    setLoading(true)
    try {
      const snapshot = await evaluateClockGeofence(true)
      setInside(snapshot.inside)
      setSiteName(snapshot.siteName)
      setLocationDenied(snapshot.locationDenied)
    } finally {
      setLoading(false)
    }
  }, [geofenceRequired])

  useEffect(() => {
    refresh()
  }, [refresh])

  const canClockIn = !geofenceRequired || inside === true

  return { loading, inside, siteName, locationDenied, canClockIn, refresh }
}
