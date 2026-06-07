import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { GeofenceCircle } from '../lib/geofence'
import {
  BASEMAP_OPTIONS,
  clampMapZoom,
  createBasemapLayer,
  defaultBasemapFromLight,
  getBasemapZoomLimits,
  type BasemapId,
} from '../lib/basemaps'
import type { MapMarker } from './LeafletMap'

export type MapCenterPinHandle = {
  getCenter: () => [number, number] | null
}

type Props = {
  /** Only used on first mount; panning does not require parent updates. */
  initialCenter: [number, number]
  /** When set, map flies here (search pick, edit load). Omit during user pan. */
  flyTo?: [number, number] | null
  zoom?: number
  markers?: MapMarker[]
  geofences?: GeofenceCircle[]
  previewGeofence?: GeofenceCircle | null
  onCenterChange?: (lat: number, lng: number) => void
  onLocate?: () => void
  className?: string
  light?: boolean
  showBasemapSwitcher?: boolean
  defaultBasemap?: BasemapId
  basemapId?: BasemapId
  onBasemapChange?: (id: BasemapId) => void
  locateLabel?: string
  zoomControl?: boolean
  /** When true, does not fire onCenterChange on first map mount (avoids wrong default geocode). */
  skipInitialCenterEmit?: boolean
  onFlyToComplete?: () => void
}

function drawCircle(layer: L.LayerGroup, g: GeofenceCircle, dashed: boolean) {
  L.circle([g.lat, g.lng], {
    radius: g.radiusM,
    color: '#ee4d2d',
    fillColor: '#ee4d2d',
    fillOpacity: dashed ? 0.08 : 0.14,
    weight: dashed ? 2 : 2.5,
    dashArray: dashed ? '6 6' : undefined,
  })
    .bindTooltip(g.label ?? '', { permanent: false, direction: 'top' })
    .addTo(layer)
}

const siteIcon = L.divIcon({
  className: 'leaflet-site-marker-light',
  html: '<span></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

export const MapCenterPin = forwardRef<MapCenterPinHandle, Props>(function MapCenterPin(
  {
    initialCenter,
    flyTo = null,
    zoom = 17,
    markers = [],
    geofences = [],
    previewGeofence = null,
    onCenterChange,
    onLocate,
    className = 'map-center-pin-wrap',
    light = false,
    showBasemapSwitcher = false,
    defaultBasemap,
    basemapId: controlledBasemapId,
    onBasemapChange,
    locateLabel,
    zoomControl = true,
    skipInitialCenterEmit = false,
    onFlyToComplete,
  },
  ref
) {
  const [internalBasemapId, setInternalBasemapId] = useState<BasemapId>(
    defaultBasemap ?? defaultBasemapFromLight(light)
  )
  const basemapControlled = controlledBasemapId !== undefined
  const basemapId = basemapControlled ? controlledBasemapId : internalBasemapId
  const setBasemapId = (id: BasemapId) => {
    if (!basemapControlled) setInternalBasemapId(id)
    onBasemapChange?.(id)
  }
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileRef = useRef<L.TileLayer | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const circleLayerRef = useRef<L.LayerGroup | null>(null)
  const suppressEventsRef = useRef(false)
  const onCenterChangeRef = useRef(onCenterChange)
  const onFlyToCompleteRef = useRef(onFlyToComplete)
  onCenterChangeRef.current = onCenterChange
  onFlyToCompleteRef.current = onFlyToComplete
  const lastFlownRef = useRef<string | null>(null)

  useImperativeHandle(ref, () => ({
    getCenter: () => {
      const map = mapRef.current
      if (!map) return null
      const c = map.getCenter()
      return [c.lat, c.lng]
    },
  }))

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const limits = getBasemapZoomLimits(basemapId)
    const map = L.map(containerRef.current, {
      zoomControl,
      attributionControl: true,
      minZoom: 3,
      maxZoom: limits.maxZoom,
    }).setView(initialCenter, clampMapZoom(zoom, basemapId))

    const tile = createBasemapLayer(basemapId)
    tile.addTo(map)
    tileRef.current = tile

    mapRef.current = map
    circleLayerRef.current = L.layerGroup().addTo(map)
    layerRef.current = L.layerGroup().addTo(map)

    const emitCenter = () => {
      if (suppressEventsRef.current) return
      const c = map.getCenter()
      onCenterChangeRef.current?.(c.lat, c.lng)
    }

    const clampZoom = () => {
      const max = map.getMaxZoom()
      if (map.getZoom() > max) {
        map.setZoom(max, { animate: false })
      }
    }

    map.on('moveend', emitCenter)
    map.on('zoomend', () => {
      clampZoom()
      emitCenter()
    })
    map.on('zoom', clampZoom)

    if (!skipInitialCenterEmit) {
      requestAnimationFrame(emitCenter)
    }

    const fitSize = () => {
      map.invalidateSize({ animate: false })
    }
    const t1 = setTimeout(fitSize, 100)
    const t2 = setTimeout(fitSize, 400)
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => fitSize())
        : null
    if (containerRef.current && ro) ro.observe(containerRef.current)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      ro?.disconnect()
      map.remove()
      mapRef.current = null
      tileRef.current = null
      layerRef.current = null
      circleLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const prev = tileRef.current
    if (!map || !prev) return
    const limits = getBasemapZoomLimits(basemapId)
    map.setMaxZoom(limits.maxZoom)
    if (map.getZoom() > limits.maxZoom) {
      map.setZoom(limits.maxZoom, { animate: false })
    }
    const next = createBasemapLayer(basemapId)
    map.addLayer(next)
    map.removeLayer(prev)
    tileRef.current = next
  }, [basemapId])

  useEffect(() => {
    if (!flyTo) {
      lastFlownRef.current = null
      return
    }
    const map = mapRef.current
    if (!map) return
    const key = `${flyTo[0].toFixed(6)},${flyTo[1].toFixed(6)}`
    if (lastFlownRef.current === key) return
    lastFlownRef.current = key

    suppressEventsRef.current = true
    const z = clampMapZoom(map.getZoom() < 14 ? zoom : map.getZoom(), basemapId)
    map.flyTo(flyTo, z, { duration: 0.35 })
    const done = () => {
      suppressEventsRef.current = false
      const c = map.getCenter()
      onCenterChangeRef.current?.(c.lat, c.lng)
      onFlyToCompleteRef.current?.()
    }
    map.once('moveend', done)
    const fallback = setTimeout(done, 500)
    return () => clearTimeout(fallback)
  }, [flyTo?.[0], flyTo?.[1], zoom])

  useEffect(() => {
    const layer = circleLayerRef.current
    if (!layer) return
    layer.clearLayers()
    geofences.forEach((g) => drawCircle(layer, g, false))
    if (previewGeofence) {
      drawCircle(layer, previewGeofence, true)
    }
  }, [geofences, previewGeofence])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    layer.clearLayers()
    markers.forEach((m) => {
      if (m.kind === 'site') {
        L.marker([m.lat, m.lng], { icon: siteIcon }).bindPopup(m.label).addTo(layer)
      }
    })
  }, [markers])

  return (
    <div className={`${className}${light ? ' map-center-pin-wrap--light' : ''}`}>
      {showBasemapSwitcher && (
        <div className="map-basemap-switcher">
          <label className="map-basemap-switcher-label" htmlFor="basemap-select">
            Basemap
          </label>
          <select
            id="basemap-select"
            className="map-basemap-switcher-select"
            value={basemapId}
            onChange={(e) => setBasemapId(e.target.value as BasemapId)}
            aria-label="Basemap style"
          >
            {BASEMAP_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div ref={containerRef} className="leaflet-map map-center-pin-map" aria-label="Map" />
      <div className="map-center-pin-marker" aria-hidden>
        <svg className="map-center-pin-svg" viewBox="0 0 32 42" width="36" height="46">
          <path
            d="M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26s16-14 16-26C32 7.2 24.8 0 16 0z"
            fill="#ee4d2d"
          />
          <circle cx="16" cy="16" r="6" fill="#fff" />
        </svg>
      </div>
      {onLocate && (
        <button
          type="button"
          className={`map-locate-btn${locateLabel ? ' map-locate-btn--text' : ''}`}
          onClick={onLocate}
          aria-label={locateLabel ?? 'Use my location'}
        >
          {locateLabel ?? '⊕'}
        </button>
      )}
    </div>
  )
})
