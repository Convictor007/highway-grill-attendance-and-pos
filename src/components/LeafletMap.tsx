import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { GeofenceCircle } from '../lib/geofence'
import 'leaflet/dist/leaflet.css'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

export type MapMarker = {
  id: string
  lat: number
  lng: number
  label: string
  kind?: 'site' | 'checkin' | 'you'
}

type Props = {
  center: [number, number]
  zoom?: number
  markers: MapMarker[]
  geofences?: GeofenceCircle[]
  className?: string
}

const defaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const siteIcon = L.divIcon({
  className: 'leaflet-site-marker',
  html: '<span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const youIcon = L.divIcon({
  className: 'leaflet-you-marker',
  html: '<span></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

export function LeafletMap({ center, zoom = 14, markers, geofences = [], className = 'leaflet-map' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const circleLayerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, { zoomControl: true }).setView(center, zoom)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map
    circleLayerRef.current = L.layerGroup().addTo(map)
    layerRef.current = L.layerGroup().addTo(map)

    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
      circleLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const layer = circleLayerRef.current
    if (!layer) return
    layer.clearLayers()
    geofences.forEach((g) => {
      L.circle([g.lat, g.lng], {
        radius: g.radiusM,
        color: '#ee4d2d',
        fillColor: '#ee4d2d',
        fillOpacity: 0.12,
        weight: 2,
      })
        .bindTooltip(g.label ?? '', { direction: 'top' })
        .addTo(layer)
    })
  }, [geofences])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    layer.clearLayers()
    const bounds: L.LatLngExpression[] = []

    markers.forEach((m) => {
      const latLng: L.LatLngExpression = [m.lat, m.lng]
      bounds.push(latLng)
      let icon: L.Icon | L.DivIcon = defaultIcon
      if (m.kind === 'site') icon = siteIcon
      if (m.kind === 'you') icon = youIcon
      L.marker(latLng, { icon }).bindPopup(m.label).addTo(layer)
    })

    if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [32, 32], maxZoom: 16 })
    } else if (bounds.length === 1) {
      map.setView(bounds[0], zoom)
    } else {
      map.setView(center, zoom)
    }
  }, [markers, center, zoom])

  return <div ref={containerRef} className={className} role="application" aria-label="Map" />
}
