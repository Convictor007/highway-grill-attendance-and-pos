import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { GeofenceCircle } from '../lib/geofence'
import {
  clampMapZoom,
  createBasemapLayer,
  getBasemapZoomLimits,
  type BasemapId,
} from '../lib/basemaps'
import type { GeoCoords } from '../lib/geolocation'

type Props = {
  coords: GeoCoords | null
  geofences?: GeofenceCircle[]
  basemapId?: BasemapId
  className?: string
}

const youIcon = L.divIcon({
  className: 'leaflet-you-marker leaflet-you-marker--live',
  html: '<span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

export function ClockLiveMap({
  coords,
  geofences = [],
  basemapId = 'streets',
  className = 'clock-live-map',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileRef = useRef<L.TileLayer | null>(null)
  const zoneLayerRef = useRef<L.LayerGroup | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const accuracyRef = useRef<L.Circle | null>(null)
  const centeredRef = useRef(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const limits = getBasemapZoomLimits(basemapId)
    const map = L.map(containerRef.current, {
      zoomControl: true,
      minZoom: 3,
      maxZoom: limits.maxZoom,
    }).setView([14.5547, 121.0244], 15)

    const tile = createBasemapLayer(basemapId)
    tile.addTo(map)
    tileRef.current = tile
    mapRef.current = map
    zoneLayerRef.current = L.layerGroup().addTo(map)

    const fitSize = () => map.invalidateSize({ animate: false })
    const t = setTimeout(fitSize, 120)

    return () => {
      clearTimeout(t)
      map.remove()
      mapRef.current = null
      tileRef.current = null
      zoneLayerRef.current = null
      markerRef.current = null
      accuracyRef.current = null
      centeredRef.current = false
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const prev = tileRef.current
    if (!map || !prev) return
    const limits = getBasemapZoomLimits(basemapId)
    map.setMaxZoom(limits.maxZoom)
    const next = createBasemapLayer(basemapId)
    map.addLayer(next)
    map.removeLayer(prev)
    tileRef.current = next
  }, [basemapId])

  useEffect(() => {
    const layer = zoneLayerRef.current
    if (!layer) return
    layer.clearLayers()
    geofences.forEach((g) => {
      L.circle([g.lat, g.lng], {
        radius: g.radiusM,
        color: '#ee4d2d',
        fillColor: '#ee4d2d',
        fillOpacity: 0.14,
        weight: 2.5,
      })
        .bindTooltip(g.label ?? 'Work zone', { direction: 'top' })
        .addTo(layer)
    })
  }, [geofences])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !coords) return

    const latLng: L.LatLngExpression = [coords.latitude, coords.longitude]

    if (!markerRef.current) {
      markerRef.current = L.marker(latLng, { icon: youIcon, zIndexOffset: 1000 })
        .bindTooltip('You are here', { permanent: false, direction: 'top' })
        .addTo(map)
    } else {
      markerRef.current.setLatLng(latLng)
    }

    if (coords.accuracyM != null && coords.accuracyM > 0) {
      if (!accuracyRef.current) {
        accuracyRef.current = L.circle(latLng, {
          radius: coords.accuracyM,
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.12,
          weight: 1,
          dashArray: '4 4',
        }).addTo(map)
      } else {
        accuracyRef.current.setLatLng(latLng)
        accuracyRef.current.setRadius(coords.accuracyM)
      }
    } else if (accuracyRef.current) {
      accuracyRef.current.remove()
      accuracyRef.current = null
    }

    if (!centeredRef.current) {
      centeredRef.current = true
      map.setView(latLng, clampMapZoom(17, basemapId), { animate: false })
    } else {
      map.panTo(latLng, { animate: true, duration: 0.35 })
    }
  }, [coords, basemapId])

  return <div ref={containerRef} className={className} role="application" aria-label="Live GPS map" />
}
