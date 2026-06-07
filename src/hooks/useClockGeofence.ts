import { useCallback, useEffect, useState } from 'react'
import { evaluateClockGeofence, evaluateZoneAtCoords } from '../lib/clockGeofence'
import type { GeoCoords } from '../lib/geolocation'
import type { GeoErrorCode } from '../lib/geolocation'

type Options = {
  /** Refresh zone UI when an active clock session starts. */
  sessionActive?: boolean
}

export function useClockGeofence(geofenceRequired: boolean, options: Options = {}) {
  const { sessionActive = false } = options
  const [loading, setLoading] = useState(false)
  const [inside, setInside] = useState<boolean | null>(null)
  const [siteName, setSiteName] = useState<string | null>(null)
  const [nearestSiteName, setNearestSiteName] = useState<string | null>(null)
  const [nearestDistanceM, setNearestDistanceM] = useState<number | null>(null)
  const [locationDenied, setLocationDenied] = useState(false)
  const [locationError, setLocationError] = useState<GeoErrorCode | null>(null)
  const [checkedOnce, setCheckedOnce] = useState(false)
  const [lastCoords, setLastCoords] = useState<GeoCoords | null>(null)
  const [requesting, setRequesting] = useState(false)

  const applySnapshot = useCallback((snapshot: Awaited<ReturnType<typeof evaluateClockGeofence>>) => {
    setInside(snapshot.inside)
    setSiteName(snapshot.siteName)
    setNearestSiteName(snapshot.nearestSiteName)
    setNearestDistanceM(snapshot.nearestDistanceM)
    setLocationDenied(snapshot.locationDenied)
    setLocationError(snapshot.locationError)
    setLastCoords(snapshot.coords)
    setCheckedOnce(true)
  }, [])

  const resetForRequired = useCallback(() => {
    setInside(null)
    setSiteName(null)
    setNearestSiteName(null)
    setNearestDistanceM(null)
    setLocationDenied(false)
    setLocationError(null)
    setLastCoords(null)
    setCheckedOnce(false)
  }, [])

  const refresh = useCallback(async () => {
    if (!geofenceRequired) {
      applySnapshot(await evaluateClockGeofence(false))
      return
    }

    setLoading(true)
    try {
      applySnapshot(await evaluateClockGeofence(true))
    } finally {
      setLoading(false)
    }
  }, [geofenceRequired, applySnapshot])

  const updateFromCoords = useCallback(
    async (coords: GeoCoords) => {
      if (!geofenceRequired) return
      setLoading(true)
      try {
        applySnapshot(await evaluateZoneAtCoords(coords))
      } finally {
        setLoading(false)
      }
    },
    [geofenceRequired, applySnapshot]
  )

  const requestLocation = useCallback(async () => {
    setRequesting(true)
    try {
      await refresh()
    } finally {
      setRequesting(false)
    }
  }, [refresh])

  useEffect(() => {
    if (!geofenceRequired) {
      applySnapshot({
        inside: true,
        siteName: null,
        locationDenied: false,
        locationError: null,
        nearestSiteName: null,
        nearestDistanceM: null,
        coords: null,
      })
      return
    }
    resetForRequired()
    void refresh()
  }, [geofenceRequired, applySnapshot, resetForRequired, refresh])

  useEffect(() => {
    if (!geofenceRequired || !sessionActive) return
    refresh()
  }, [geofenceRequired, sessionActive, refresh])

  const canClockIn =
    !geofenceRequired || (checkedOnce && inside === true && !locationDenied)

  return {
    loading,
    inside,
    siteName,
    nearestSiteName,
    nearestDistanceM,
    locationDenied,
    locationError,
    checkedOnce,
    lastCoords,
    canClockIn,
    requesting,
    refresh,
    requestLocation,
    updateFromCoords,
  }
}
