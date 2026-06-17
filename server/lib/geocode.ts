import { ValidationError } from './errors'

const USER_AGENT = 'HighwayGrill-HRMS/1.0 (local-dev)'
const memCache = new Map<string, unknown>()

type Addr = Record<string, string | undefined>

export type GeocodeResult = {
  latitude: number
  longitude: number
  formatted: string
  short: string
  parts: { region_line: string; postal_code: string; street_line: string }
}

export async function reverse(latitude: number, longitude: number): Promise<GeocodeResult> {
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new ValidationError('Invalid coordinates')
  }
  const cacheKey = `reverse:${latitude.toFixed(5)},${longitude.toFixed(5)}`
  if (memCache.has(cacheKey)) return memCache.get(cacheKey) as GeocodeResult
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=19&addressdetails=1&accept-language=en`
  const data = await fetchJson(url)
  const formatted = String(data.display_name ?? '')
  const addr = (data.address ?? {}) as Addr
  const result = buildResult(latitude, longitude, formatted, addr)
  memCache.set(cacheKey, result)
  return result
}

export async function search(query: string, limit = 6): Promise<GeocodeResult[]> {
  const q = query.trim()
  if (q.length < 3) return []
  const cacheKey = `search:${q.toLowerCase()}:${limit}`
  if (memCache.has(cacheKey)) return memCache.get(cacheKey) as GeocodeResult[]
  const queries = [expandSearchQuery(q)]
  if (queries[0] !== q) queries.push(q)
  const seen = new Set<string>()
  const out: GeocodeResult[] = []
  for (const term of queries) {
    const params = new URLSearchParams({
      format: 'jsonv2',
      q: term,
      limit: String(Math.min(limit, 10)),
      countrycodes: 'ph',
      addressdetails: '1',
      'accept-language': 'en',
    })
    const rows = await fetchJsonArray(`https://nominatim.openstreetmap.org/search?${params}`)
    if (!rows.length) continue
    for (const row of rows) {
      if (!row || row.lat == null || row.lon == null) continue
      const lat = Number(row.lat)
      const lng = Number(row.lon)
      const key = `${lat.toFixed(5)},${lng.toFixed(5)}`
      if (seen.has(key)) continue
      seen.add(key)
      const addr = (row.address ?? {}) as Addr
      out.push(buildResult(lat, lng, String(row.display_name ?? ''), addr))
      if (out.length >= limit) break
    }
    if (out.length >= limit) break
  }
  memCache.set(cacheKey, out)
  return out
}

function expandSearchQuery(query: string) {
  const lower = query.toLowerCase()
  if (lower.includes('philippines') || lower.includes('camarines')) return query
  return `${query}, Camarines Sur, Philippines`
}

function buildResult(lat: number, lng: number, formatted: string, addr: Addr): GeocodeResult {
  const parts = parseParts(addr)
  const short = shortAddress(addr, formatted)
  return { latitude: lat, longitude: lng, formatted: displayAddress(formatted, parts, short), short, parts }
}

function displayAddress(formatted: string, parts: GeocodeResult['parts'], short: string) {
  const f = formatted.trim()
  if (f.length >= 20) return f
  const built = [parts.street_line, parts.region_line, parts.postal_code].filter(Boolean).join(', ')
  if (built) return built
  return f || short
}

function shortAddress(addr: Addr, fallback: string) {
  const parts = [streetLine(addr), barangayLine(addr), municipalityLine(addr)].filter(Boolean)
  if (parts.length) return parts.join(', ')
  return fallback || 'Unknown location'
}

function parseParts(addr: Addr) {
  const region = [...new Set([addr.state ?? addr.region, addr.province ?? addr.state_district ?? addr.county, municipalityLine(addr) || null, barangayLine(addr) || null].filter(Boolean))]
  return {
    region_line: region.join(', '),
    postal_code: String(addr.postcode ?? ''),
    street_line: streetLine(addr),
  }
}

function streetLine(addr: Addr) {
  return [addr.house_number, addr.road ?? addr.street ?? addr.pedestrian ?? addr.footway ?? addr.residential].filter(Boolean).join(' ')
}

function barangayLine(addr: Addr) {
  for (const key of ['suburb', 'neighbourhood', 'quarter', 'village', 'hamlet', 'city_district']) {
    if (addr[key]) return String(addr[key])
  }
  return ''
}

function municipalityLine(addr: Addr) {
  for (const key of ['city', 'town', 'municipality']) {
    if (addr[key]) return String(addr[key])
  }
  return ''
}

async function fetchJsonArray(url: string, attempt = 0): Promise<Record<string, unknown>[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  if (res.status === 429 && attempt < 2) {
    await new Promise((r) => setTimeout(r, 1100))
    return fetchJsonArray(url, attempt + 1)
  }
  if (!res.ok) throw new ValidationError(`Geocoding service unavailable (HTTP ${res.status})`)
  const data = await res.json()
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : []
}

async function fetchJson(url: string, attempt = 0): Promise<Record<string, unknown> & { display_name?: string; address?: Addr }> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  if (res.status === 429 && attempt < 2) {
    await new Promise((r) => setTimeout(r, 1100))
    return fetchJson(url, attempt + 1)
  }
  if (!res.ok) throw new ValidationError(`Geocoding service unavailable (HTTP ${res.status})`)
  const data = await res.json()
  if (!data || typeof data !== 'object') throw new ValidationError('Invalid geocoding response')
  return data as Record<string, unknown> & { display_name?: string; address?: Addr }
}
