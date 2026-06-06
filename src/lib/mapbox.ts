/** Mapbox config from Vite env (see .env VITE_MAPBOX_*). */

export function getMapboxAccessToken(): string {
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim() ?? ''
  return token
}

export function isMapboxEnabled(): boolean {
  return getMapboxAccessToken().length > 0
}

/** mapbox://styles/mapbox/streets-v11 → mapbox/streets-v11 */
export function parseMapboxStylePath(styleUrl?: string): string | null {
  const raw = (styleUrl ?? import.meta.env.VITE_MAPBOX_STYLE_URL ?? '').trim()
  if (!raw) return null
  const match = raw.match(/^mapbox:\/\/styles\/(.+)$/i)
  return match ? match[1] : null
}

export function mapboxRasterTileUrl(stylePath: string): string {
  const token = getMapboxAccessToken()
  return `https://api.mapbox.com/styles/v1/${stylePath}/tiles/{z}/{x}/{y}?access_token=${encodeURIComponent(token)}`
}

export const MAPBOX_ATTRIBUTION =
  '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
