import L from 'leaflet'
import {
  isMapboxEnabled,
  MAPBOX_ATTRIBUTION,
  mapboxRasterTileUrl,
  parseMapboxStylePath,
} from './mapbox'

export type BasemapId = 'streets' | 'light' | 'satellite' | 'dark'

export type BasemapOption = {
  id: BasemapId
  label: string
}

const MAPBOX_STYLES: Record<BasemapId, string> = {
  streets: 'mapbox/streets-v11',
  light: 'mapbox/light-v11',
  satellite: 'mapbox/satellite-streets-v12',
  dark: 'mapbox/dark-v11',
}

export const BASEMAP_OPTIONS: BasemapOption[] = [
  { id: 'streets', label: 'Streets' },
  { id: 'light', label: 'Light' },
  { id: 'satellite', label: 'Satellite' },
  { id: 'dark', label: 'Dark' },
]

/**
 * maxNativeZoom must equal maxZoom so Leaflet does not upscale blank tiles.
 */
export function getBasemapZoomLimits(id: BasemapId): { maxZoom: number; maxNativeZoom: number } {
  if (isMapboxEnabled()) {
    switch (id) {
      case 'satellite':
        return { maxZoom: 17, maxNativeZoom: 17 }
      case 'streets':
        return { maxZoom: 19, maxNativeZoom: 19 }
      case 'light':
      case 'dark':
      default:
        return { maxZoom: 18, maxNativeZoom: 18 }
    }
  }
  switch (id) {
    case 'satellite':
      return { maxZoom: 16, maxNativeZoom: 16 }
    case 'light':
    case 'dark':
      return { maxZoom: 17, maxNativeZoom: 17 }
    case 'streets':
    default:
      return { maxZoom: 18, maxNativeZoom: 18 }
  }
}

export function clampMapZoom(zoom: number, basemapId: BasemapId): number {
  const { maxZoom } = getBasemapZoomLimits(basemapId)
  return Math.max(3, Math.min(zoom, maxZoom))
}

const TILE_OPTS = {
  detectRetina: false,
  updateWhenZooming: true,
  keepBuffer: 2,
}

function createMapboxLayer(stylePath: string, maxZoom: number, maxNativeZoom: number): L.TileLayer {
  return L.tileLayer(mapboxRasterTileUrl(stylePath), {
    ...TILE_OPTS,
    attribution: MAPBOX_ATTRIBUTION,
    maxZoom,
    maxNativeZoom,
    tileSize: 512,
    zoomOffset: -1,
  })
}

function createFallbackLayer(id: BasemapId): L.TileLayer {
  const { maxZoom, maxNativeZoom } = getBasemapZoomLimits(id)
  switch (id) {
    case 'light':
      return L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        ...TILE_OPTS,
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom,
        maxNativeZoom,
      })
    case 'satellite':
      return L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          ...TILE_OPTS,
          attribution: '&copy; Esri',
          maxZoom,
          maxNativeZoom,
        }
      )
    case 'dark':
      return L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        ...TILE_OPTS,
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom,
        maxNativeZoom,
      })
    case 'streets':
    default:
      return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        ...TILE_OPTS,
        attribution: '&copy; OpenStreetMap',
        maxZoom,
        maxNativeZoom,
      })
  }
}

export function createBasemapLayer(id: BasemapId): L.TileLayer {
  const { maxZoom, maxNativeZoom } = getBasemapZoomLimits(id)

  if (isMapboxEnabled()) {
    const envStyle = parseMapboxStylePath()
    const stylePath = id === 'streets' && envStyle ? envStyle : MAPBOX_STYLES[id]
    return createMapboxLayer(stylePath, maxZoom, maxNativeZoom)
  }

  return createFallbackLayer(id)
}

export function defaultBasemapFromLight(light?: boolean): BasemapId {
  if (light) {
    return 'light'
  }
  return 'streets'
}

export function getDefaultBasemapId(): BasemapId {
  return defaultBasemapFromLight(false)
}

export { isMapboxEnabled } from './mapbox'
