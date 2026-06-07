import { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal } from './Modal'
import { ClockLiveMap } from './ClockLiveMap'
import { api } from '../lib/api'
import { fetchZoneStatus } from '../lib/fieldWork'
import { geoErrorMessage, watchPosition, type GeoCoords, type GeoErrorCode } from '../lib/geolocation'
import { reverseGeocode } from '../lib/geocode'
import type { GeofenceCircle } from '../lib/geofence'
import { BASEMAP_OPTIONS, type BasemapId } from '../lib/basemaps'

type ClockZone = {
  id: string
  name: string
  latitude: string
  longitude: string
  radius_m: number
}

type Props = {
  open: boolean
  onClose: () => void
  geofenceRequired?: boolean
}

export function ClockLocationModal({ open, onClose, geofenceRequired = false }: Props) {
  const [coords, setCoords] = useState<GeoCoords | null>(null)
  const [geoError, setGeoError] = useState<GeoErrorCode | null>(null)
  const [zones, setZones] = useState<ClockZone[]>([])
  const [inside, setInside] = useState<boolean | null>(null)
  const [siteName, setSiteName] = useState<string | null>(null)
  const [nearestM, setNearestM] = useState<number | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [basemapId, setBasemapId] = useState<BasemapId>('streets')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const geofences = useMemo<GeofenceCircle[]>(
    () =>
      zones.map((z) => ({
        id: z.id,
        lat: Number(z.latitude),
        lng: Number(z.longitude),
        radiusM: Number(z.radius_m) || 100,
        label: z.name,
      })),
    [zones]
  )

  const refreshZoneStatus = useCallback(async (c: GeoCoords) => {
    if (!geofenceRequired) {
      setInside(null)
      setSiteName(null)
      setNearestM(null)
      return
    }
    try {
      const status = await fetchZoneStatus(c.latitude, c.longitude, {
        clockInOnly: true,
        accuracyM: c.accuracyM,
      })
      setInside(status.inside)
      setSiteName(status.site?.name ?? null)
      setNearestM(status.nearest_distance_m ?? null)
    } catch {
      setInside(null)
    }
  }, [geofenceRequired])

  useEffect(() => {
    if (!open) {
      setCoords(null)
      setGeoError(null)
      setAddress(null)
      setUpdatedAt(null)
      setInside(null)
      setSiteName(null)
      setNearestM(null)
      return
    }

    if (geofenceRequired) {
      api<ClockZone[]>('/field-work/sites')
        .then(setZones)
        .catch(() => setZones([]))
    } else {
      setZones([])
    }

    const stop = watchPosition(
      (c) => {
        setCoords(c)
        setGeoError(null)
        setUpdatedAt(new Date())
        void refreshZoneStatus(c)
      },
      (code) => setGeoError(code)
    )

    return stop
  }, [open, geofenceRequired, refreshZoneStatus])

  useEffect(() => {
    if (!open || !coords) return
    const t = setTimeout(() => {
      reverseGeocode(coords.latitude, coords.longitude)
        .then((r) => setAddress(r.short || r.formatted))
        .catch(() => setAddress(null))
    }, 400)
    return () => clearTimeout(t)
  }, [open, coords?.latitude, coords?.longitude])

  const statusClass =
    inside === null
      ? 'clock-live-status'
      : inside
        ? 'clock-live-status clock-live-status--ok'
        : 'clock-live-status clock-live-status--warn'

  return (
    <Modal
      open={open}
      title="Live location"
      onClose={onClose}
      size="large"
      panelClassName="clock-location-modal"
      footer={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="clock-live-toolbar">
        <div className={statusClass} role="status">
          {geoError ? (
            geoErrorMessage(geoError)
          ) : !coords ? (
            'Acquiring GPS…'
          ) : geofenceRequired ? (
            inside ? (
              <>
                Inside work zone: <strong>{siteName ?? 'Branch'}</strong>
              </>
            ) : (
              <>
                Outside work zone
                {nearestM != null && (
                  <span className="clock-live-status-detail">
                    {' '}
                    · nearest zone {Math.round(nearestM)} m
                  </span>
                )}
              </>
            )
          ) : (
            'Live GPS — your current position'
          )}
        </div>
        <div className="map-basemap-switcher clock-live-basemap">
          <label className="map-basemap-switcher-label" htmlFor="clock-live-basemap">
            Basemap
          </label>
          <select
            id="clock-live-basemap"
            className="map-basemap-switcher-select"
            value={basemapId}
            onChange={(e) => setBasemapId(e.target.value as BasemapId)}
          >
            {BASEMAP_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ClockLiveMap coords={coords} geofences={geofenceRequired ? geofences : []} basemapId={basemapId} />

      {coords && (
        <dl className="clock-live-meta">
          <div>
            <dt>Coordinates</dt>
            <dd>
              {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
            </dd>
          </div>
          {coords.accuracyM != null && (
            <div>
              <dt>GPS accuracy</dt>
              <dd>±{Math.round(coords.accuracyM)} m</dd>
            </div>
          )}
          {address && (
            <div>
              <dt>Address</dt>
              <dd>{address}</dd>
            </div>
          )}
          {updatedAt && (
            <div>
              <dt>Updated</dt>
              <dd>{updatedAt.toLocaleTimeString()}</dd>
            </div>
          )}
        </dl>
      )}
      <p className="geofence-hint clock-live-hint">
        Blue circle = GPS accuracy. Orange zone = branch check-in area. Position updates automatically.
      </p>
    </Modal>
  )
}
