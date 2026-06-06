import { api } from './api'

export type AddressParts = {
  region_line: string
  postal_code: string
  street_line: string
}

export type GeocodeResult = {
  latitude: number
  longitude: number
  formatted: string
  short: string
  parts: AddressParts
}

const cache = new Map<string, GeocodeResult>()

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`
}

export const emptyParts = (): AddressParts => ({
  region_line: '',
  postal_code: '',
  street_line: '',
})

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
  const key = cacheKey(lat, lng)
  const hit = cache.get(key)
  if (hit) return hit

  const data = await api<GeocodeResult>(
    `/geocode/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
  )
  data.parts = data.parts ?? emptyParts()
  cache.set(key, data)
  return data
}

export async function searchAddress(query: string): Promise<GeocodeResult[]> {
  if (query.trim().length < 3) return []
  const rows = await api<GeocodeResult[]>(`/geocode/search?q=${encodeURIComponent(query.trim())}`)
  return rows.map((r) => ({ ...r, parts: r.parts ?? emptyParts() }))
}

export function useDebouncedGeocode(delayMs = 500) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastId = 0

  return (lat: number, lng: number, onResult: (r: GeocodeResult | null) => void, onError?: () => void) => {
    if (timer) clearTimeout(timer)
    const id = ++lastId
    timer = setTimeout(async () => {
      try {
        const r = await reverseGeocode(lat, lng)
        if (id === lastId) onResult(r)
      } catch {
        if (id === lastId) onError?.()
      }
    }, delayMs)
  }
}
