import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { MapCenterPin } from '../../components/MapCenterPin'
import type { MapMarker } from '../../components/LeafletMap'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmptyState } from '../../components/EmptyState'
import {
  emptyParts,
  searchAddress,
  useDebouncedGeocode,
  type AddressParts,
  type GeocodeResult,
} from '../../lib/geocode'
import { getCurrentPosition } from '../../lib/geolocation'
import { matchGeofenceSite, type GeofenceCircle } from '../../lib/geofence'
import { fetchZoneStatus, type FieldCheckinResult } from '../../lib/fieldWork'

interface FieldSite {
  id: string
  name: string
  address: string | null
  latitude: string
  longitude: string
  radius_m: number
}

interface FieldCheckin {
  id: string
  latitude: string
  longitude: string
  address: string | null
  notes: string | null
  checked_in_at: string
  site_name: string | null
}

const DEFAULT_CENTER: [number, number] = [14.5547, 121.0244]

export function FieldWorkPage() {
  const [sites, setSites] = useState<FieldSite[]>([])
  const [checkins, setCheckins] = useState<FieldCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER)
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null)
  const [parts, setParts] = useState<AddressParts>(emptyParts())
  const [formatted, setFormatted] = useState('')
  const [addressLoading, setAddressLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [notes, setNotes] = useState('')
  const [success, setSuccess] = useState<string | null>(null)
  const [gpsCoords, setGpsCoords] = useState<[number, number] | null>(null)
  const gpsSet = useRef(false)
  const runGeocode = useMemo(() => useDebouncedGeocode(400), [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, c] = await Promise.all([
        api<FieldSite[]>('/field-work/sites'),
        api<FieldCheckin[]>('/field-work/checkins?limit=20'),
      ])
      setSites(s)
      setCheckins(c)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const applyGeocode = useCallback((r: GeocodeResult) => {
    setParts(r.parts ?? emptyParts())
    setFormatted(r.formatted || r.short)
  }, [])

  const handleCenterChange = useCallback(
    (lat: number, lng: number) => {
      setMapCenter([lat, lng])
      setAddressLoading(true)
      setShowResults(false)
      runGeocode(
        lat,
        lng,
        (r) => {
          if (r) applyGeocode(r)
          setAddressLoading(false)
        },
        () => setAddressLoading(false)
      )
    },
    [runGeocode, applyGeocode]
  )

  const locateMe = useCallback(async () => {
    const coords = await getCurrentPosition()
    if (coords) {
      gpsSet.current = true
      const pos: [number, number] = [coords.latitude, coords.longitude]
      setGpsCoords(pos)
      setMapCenter(pos)
      setFlyTo(pos)
    }
  }, [])

  useEffect(() => {
    locateMe()
  }, [locateMe])

  useEffect(() => {
    if (searchQuery.trim().length < 3) {
      setSearchResults([])
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const rows = await searchAddress(searchQuery)
        setSearchResults(rows)
        setShowResults(true)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 450)
    return () => clearTimeout(t)
  }, [searchQuery])

  const pickSearchResult = (r: GeocodeResult) => {
    const pos: [number, number] = [r.latitude, r.longitude]
    setMapCenter(pos)
    setFlyTo(pos)
    applyGeocode(r)
    setSearchQuery(r.short || r.formatted)
    setShowResults(false)
  }

  const geofences = useMemo<GeofenceCircle[]>(
    () =>
      sites.map((s) => ({
        id: s.id,
        lat: Number(s.latitude),
        lng: Number(s.longitude),
        radiusM: Number(s.radius_m) || 150,
        label: s.name,
      })),
    [sites]
  )

  const zoneMatch = useMemo(() => {
    const [lat, lng] = gpsCoords ?? mapCenter
    return matchGeofenceSite(lat, lng, sites)
  }, [gpsCoords, mapCenter, sites])

  const insideZone = zoneMatch !== null

  const fullAddress = formatted || [parts.street_line, parts.region_line, parts.postal_code].filter(Boolean).join(', ')

  const handleCheckIn = async () => {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const pos = await getCurrentPosition()
      if (!pos) {
        setError('Allow location access to check in inside a work zone.')
        return
      }
      const { latitude: lat, longitude: lng } = pos
      const zone = await fetchZoneStatus(lat, lng)
      if (!zone.inside || !zone.site) {
        setError('You are outside a registered work zone. Move closer and try again.')
        return
      }
      const result = await api<FieldCheckinResult>('/field-work/checkin', {
        method: 'POST',
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          address: fullAddress || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      setNotes('')
      const siteLabel = result.site_name ?? zone.site.name
      if (result.attendance_action === 'clocked_in') {
        setSuccess(`Checked in at ${siteLabel}. You are clocked in for today.`)
      } else if (result.attendance_action === 'linked') {
        setSuccess(`Field visit logged at ${siteLabel} (linked to your open attendance).`)
      } else {
        setSuccess(`Checked in at ${siteLabel}.`)
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check-in failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="field-work-page">
        <LoadingBlock />
      </div>
    )
  }

  return (
    <div className="field-work-page">
      <div className="address-picker">
        <div className="address-picker-search-wrap">
          <span className="address-picker-search-icon" aria-hidden>
            ⌕
          </span>
          <input
            type="search"
            className="address-picker-search"
            placeholder="Search for your address here"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
          />
          {searching && <span className="address-picker-search-status">Searching…</span>}
          {showResults && searchResults.length > 0 && (
            <ul className="address-picker-suggestions">
              {searchResults.map((r, i) => (
                <li key={`${r.latitude}-${r.longitude}-${i}`}>
                  <button type="button" onClick={() => pickSearchResult(r)}>
                    {r.short || r.formatted}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="address-picker-section">
          <h2 className="address-picker-heading">Address</h2>

          <div className="address-picker-field">
            <span className="address-picker-label">Region, Province, City, Barangay</span>
            <span className="address-picker-value">
              {addressLoading ? 'Updating…' : parts.region_line || 'Move the map to set location'}
            </span>
          </div>

          <div className="address-picker-field">
            <span className="address-picker-label">Postal Code</span>
            <span className="address-picker-value">
              {addressLoading ? '—' : parts.postal_code || '—'}
            </span>
          </div>

          <div className="address-picker-field">
            <span className="address-picker-label">Street Name, Building, House No.</span>
            <span className="address-picker-value">
              {addressLoading ? '—' : parts.street_line || '—'}
            </span>
          </div>
        </div>

        <MapCenterPin
          initialCenter={DEFAULT_CENTER}
          flyTo={flyTo}
          zoom={17}
          geofences={geofences}
          onCenterChange={handleCenterChange}
          onLocate={locateMe}
          light
          className="map-center-pin-wrap map-center-pin-wrap--embedded"
        />

        <div
          className={`geofence-status-banner${insideZone ? ' geofence-status-banner--ok' : ' geofence-status-banner--warn'}`}
          role="status"
        >
          {sites.length === 0 ? (
            <>No work zones configured yet. Contact HR.</>
          ) : insideZone ? (
            <>
              Inside work zone: <strong>{zoneMatch.site.name}</strong>
              {zoneMatch.distanceM > 0 && (
                <span className="geofence-status-distance"> ({Math.round(zoneMatch.distanceM)} m from center)</span>
              )}
            </>
          ) : (
            <>Outside all work zones — move inside the orange circle on the map to check in.</>
          )}
        </div>

        <div className="address-picker-section">
          <h2 className="address-picker-heading">Notes (optional)</h2>
          <input
            type="text"
            className="address-picker-notes"
            placeholder="e.g. Supplier delivery, catering setup"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {success && <p className="address-picker-success">{success}</p>}
        {error && <p className="address-picker-error">{error}</p>}

        <div className="address-picker-actions">
          <button
            type="button"
            className="btn address-picker-submit"
            disabled={busy || addressLoading || !insideZone || sites.length === 0 || !gpsCoords}
            onClick={handleCheckIn}
          >
            {busy ? 'Saving…' : !gpsCoords ? 'Enable location' : insideZone ? 'Check in' : 'Move inside a work zone'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h2 className="section-title">Recent check-ins</h2>
        {checkins.length === 0 ? (
          <EmptyState title="No check-ins yet" description="Your field visits will appear here." />
        ) : (
          <ul className="field-checkin-list">
            {checkins.map((c) => (
              <li key={c.id} className="field-checkin-row">
                <div>
                  <strong>{c.site_name ?? 'Off-site'}</strong>
                  {c.address && <span className="field-checkin-notes">{c.address}</span>}
                  <span className="field-checkin-time">
                    {new Date(c.checked_in_at.replace(' ', 'T')).toLocaleString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
