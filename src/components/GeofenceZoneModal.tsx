import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import { Modal } from './Modal'
import { MapCenterPin } from './MapCenterPin'
import {
  DEFAULT_ZONE_RADIUS_M,
  GeofenceAreaControl,
  MAX_ZONE_RADIUS_M,
  MIN_ZONE_RADIUS_M,
} from './GeofenceAreaControl'
import type { GeofenceCircle } from '../lib/geofence'
import {
  emptyParts,
  reverseGeocode,
  searchAddress,
  useDebouncedGeocode,
  type AddressParts,
  type GeocodeResult,
} from '../lib/geocode'
import { branchMapCenter } from '../lib/branchMapCenter'

export type GeofenceSiteInput = {
  id: string
  branch_id: string | null
  name: string
  address: string | null
  latitude: string
  longitude: string
  radius_m: number
}

type Branch = {
  id: string
  name: string
  default_latitude?: string | number | null
  default_longitude?: string | number | null
}

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  branches: Branch[]
  sites: GeofenceSiteInput[]
  editingSite?: GeofenceSiteInput | null
}

const DEFAULT_CENTER: [number, number] = [14.5547, 121.0244]

function siteToCircle(s: GeofenceSiteInput): GeofenceCircle {
  return {
    id: s.id,
    lat: Number(s.latitude),
    lng: Number(s.longitude),
    radiusM: Number(s.radius_m) || 150,
    label: s.name,
  }
}

function defaultBranchId(branches: Branch[]): string {
  const match = branches.find((b) => /highway grill/i.test(b.name))
  return match?.id ?? branches[0]?.id ?? ''
}

function deriveZoneName(r: GeocodeResult): string {
  const short = (r.short || '').trim()
  if (short.length > 0 && short.length <= 80) return short
  const first = (r.formatted || '').split(',')[0]?.trim()
  return first && first.length <= 80 ? first : 'Work zone'
}

export function GeofenceZoneModal({
  open,
  onClose,
  onSaved,
  branches,
  sites,
  editingSite = null,
}: Props) {
  const [editId, setEditId] = useState<string | null>(null)
  const [relocating, setRelocating] = useState(false)
  const [circleCenter, setCircleCenter] = useState<[number, number]>(DEFAULT_CENTER)
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null)
  const [radiusM, setRadiusM] = useState(DEFAULT_ZONE_RADIUS_M)
  const [zoneName, setZoneName] = useState('')
  const [zoneBranchId, setZoneBranchId] = useState('')
  const [parts, setParts] = useState<AddressParts>(emptyParts())
  const [formatted, setFormatted] = useState('')
  const [addressLoading, setAddressLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const panCenterRef = useRef<[number, number]>(DEFAULT_CENTER)
  const mapMountKeyRef = useRef(0)
  const initSessionRef = useRef<string | null>(null)

  const clearFlyTo = useCallback(() => setFlyTo(null), [])

  const flyToTarget = useCallback((coords: [number, number]) => {
    setFlyTo(coords)
  }, [])

  const isEditMode = editId !== null
  const showSearch = !isEditMode || relocating
  const showEditSplit = isEditMode && !relocating

  const runGeocode = useMemo(() => useDebouncedGeocode(400), [])

  const applyGeocode = useCallback((r: GeocodeResult) => {
    setParts(r.parts ?? emptyParts())
    setFormatted(r.formatted || r.short)
  }, [])

  const fetchAddress = useCallback(
    (lat: number, lng: number) => {
      setAddressLoading(true)
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

  const resetState = useCallback(() => {
    setEditId(null)
    setRelocating(false)
    setCircleCenter(DEFAULT_CENTER)
    panCenterRef.current = DEFAULT_CENTER
    setFlyTo(null)
    setRadiusM(DEFAULT_ZONE_RADIUS_M)
    setZoneName('')
    setZoneBranchId('')
    setParts(emptyParts())
    setFormatted('')
    setSearchQuery('')
    setSearchResults([])
    setShowResults(false)
    setError(null)
    mapMountKeyRef.current += 1
  }, [])

  useEffect(() => {
    if (!open) {
      initSessionRef.current = null
      return
    }

    const sessionKey = editingSite?.id ?? 'new'
    if (initSessionRef.current === sessionKey) return
    initSessionRef.current = sessionKey

    if (editingSite) {
      const coords: [number, number] = [
        Number(editingSite.latitude),
        Number(editingSite.longitude),
      ]
      setEditId(editingSite.id)
      setRelocating(false)
      setZoneName(editingSite.name)
      setZoneBranchId(editingSite.branch_id ?? '')
      setRadiusM(
        Math.max(MIN_ZONE_RADIUS_M, Math.min(MAX_ZONE_RADIUS_M, Number(editingSite.radius_m) || DEFAULT_ZONE_RADIUS_M))
      )
      setCircleCenter(coords)
      panCenterRef.current = coords
      flyToTarget(coords)
      setFormatted(editingSite.address ?? '')
      fetchAddress(coords[0], coords[1])
    } else {
      resetState()
      initSessionRef.current = 'new'
      const bid = defaultBranchId(branches)
      setZoneBranchId(bid)
      const initial = branchMapCenter(bid, branches, sites, DEFAULT_CENTER)
      setCircleCenter(initial)
      panCenterRef.current = initial
      flyToTarget(initial)
    }
  }, [open, editingSite?.id, resetState, fetchAddress, flyToTarget, editingSite, branches, sites])

  useEffect(() => {
    if (!open || !showSearch || searchQuery.trim().length < 3) {
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
  }, [open, showSearch, searchQuery])

  const handleMapPan = useCallback(
    (lat: number, lng: number) => {
      panCenterRef.current = [lat, lng]
      setCircleCenter([lat, lng])
      if (showEditSplit || relocating) {
        fetchAddress(lat, lng)
      }
    },
    [showEditSplit, relocating, fetchAddress]
  )

  const pickSearchResult = (r: GeocodeResult) => {
    const coords: [number, number] = [r.latitude, r.longitude]
    panCenterRef.current = coords
    setCircleCenter(coords)
    flyToTarget(coords)
    applyGeocode(r)
    setSearchQuery(r.short || r.formatted)
    setShowResults(false)
    if (isEditMode) {
      setRelocating(false)
    }
  }

  const geofences = useMemo(
    () => sites.filter((s) => s.id !== editId).map(siteToCircle),
    [sites, editId]
  )

  const previewGeofence = useMemo<GeofenceCircle>(
    () => ({
      id: 'preview',
      lat: circleCenter[0],
      lng: circleCenter[1],
      radiusM: radiusM,
      label: zoneName || 'Work zone',
    }),
    [circleCenter[0], circleCenter[1], radiusM, zoneName]
  )

  const fullAddress =
    formatted || [parts.street_line, parts.region_line, parts.postal_code].filter(Boolean).join(', ')

  const resolveGeocodeForSave = async (): Promise<GeocodeResult | null> => {
    const lat = circleCenter[0]
    const lng = circleCenter[1]
    panCenterRef.current = [lat, lng]
    try {
      return await reverseGeocode(lat, lng)
    } catch {
      return null
    }
  }

  const saveZone = async () => {
    setError(null)
    const lat = circleCenter[0]
    const lng = circleCenter[1]
    panCenterRef.current = [lat, lng]

    if (isEditMode) {
      if (!zoneName.trim()) {
        setError('Enter a zone name')
        return
      }
      if (!zoneBranchId) {
        setError('Select a branch for this work zone')
        return
      }
    }

    setSaving(true)
    try {
      let name = zoneName.trim()
      let address: string | undefined
      let branchId = zoneBranchId || null

      const geo = await resolveGeocodeForSave()
      if (!geo) {
        setError('Could not resolve address for this location')
        return
      }
      applyGeocode(geo)
      address = geo.formatted || geo.short || undefined

      if (!isEditMode) {
        name = deriveZoneName(geo)
        branchId = defaultBranchId(branches) || null
        if (!branchId) {
          setError('No branch configured — add a branch in settings first')
          return
        }
      } else if (!name) {
        name = deriveZoneName(geo)
      }

      const body = {
        name,
        address,
        branch_id: branchId,
        latitude: lat,
        longitude: lng,
        radius_m: radiusM,
      }

      if (editId) {
        await api(`/field-work/sites/${editId}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await api('/field-work/sites', { method: 'POST', body: JSON.stringify(body) })
      }
      onSaved()
      onClose()
      resetState()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save zone')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    onClose()
    resetState()
  }

  const startRelocate = () => {
    setRelocating(true)
    setError(null)
    setShowResults(false)
  }

  const footer = showEditSplit ? (
    <>
      <button type="button" className="btn btn-ghost" onClick={handleClose}>
        Cancel
      </button>
      <button type="button" className="btn btn-primary" disabled={saving || addressLoading} onClick={saveZone}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </>
  ) : (
    <>
      {relocating && (
        <button type="button" className="btn btn-ghost" onClick={() => setRelocating(false)}>
          Back to details
        </button>
      )}
      <button type="button" className="btn btn-ghost" onClick={handleClose}>
        Cancel
      </button>
      <button type="button" className="btn btn-primary" disabled={saving} onClick={saveZone}>
        {saving ? 'Saving…' : isEditMode ? 'Save changes' : 'Save zone'}
      </button>
    </>
  )

  const mapStack = (
    <div className={`geofence-map-stack${showEditSplit ? ' geofence-map-stack--gis' : ''}`}>
      <MapCenterPin
        key={`geofence-map-${mapMountKeyRef.current}`}
        initialCenter={circleCenter}
        flyTo={flyTo}
        zoom={15}
        geofences={geofences}
        previewGeofence={previewGeofence}
        onCenterChange={handleMapPan}
        onFlyToComplete={clearFlyTo}
        showBasemapSwitcher
        defaultBasemap="satellite"
        className="map-center-pin-wrap geofence-modal-map"
      />
      <GeofenceAreaControl radiusM={radiusM} onChange={setRadiusM} />
    </div>
  )

  const searchBar = (
    <div className="geofence-search-wrap">
      <div className="geofence-modal-search">
        <span className="geofence-modal-search-icon" aria-hidden>
          ⌕
        </span>
        <input
          type="search"
          className="geofence-modal-search-input"
          placeholder="Search Highway Grill, street, or city…"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setShowResults(true)
          }}
          onFocus={() => searchResults.length > 0 && setShowResults(true)}
          autoComplete="off"
          aria-expanded={showResults && searchResults.length > 0}
          aria-controls="geofence-search-listbox"
          role="combobox"
        />
        {searching && <span className="geofence-modal-search-spinner">…</span>}
        {searchQuery.length > 0 && !searching && (
          <button
            type="button"
            className="geofence-search-clear"
            onClick={() => {
              setSearchQuery('')
              setSearchResults([])
              setShowResults(false)
            }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>
      {showResults && searchResults.length > 0 && (
        <ul id="geofence-search-listbox" className="geofence-modal-suggestions" role="listbox">
          {searchResults.map((r, i) => (
            <li key={`${r.latitude}-${r.longitude}-${i}`} role="option">
              <button type="button" onClick={() => pickSearchResult(r)}>
                <span className="geofence-suggestion-primary">{r.short || r.formatted}</span>
                {r.formatted && r.short && r.formatted !== r.short && (
                  <span className="geofence-suggestion-secondary">{r.formatted}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  if (!open) return null

  return (
    <Modal
      open={open}
      title={isEditMode ? 'Edit work zone' : 'Add work zone'}
      onClose={handleClose}
      footer={footer}
      size="large"
      hideHeader
      closeOnBackdropClick={false}
      panelClassName={`geofence-zone-modal-panel${showEditSplit ? ' geofence-zone-modal-panel--edit' : ''}`}
    >
      <div className={`geofence-modal-topbar${showEditSplit ? ' geofence-modal-topbar--edit' : ''}`}>
        {showSearch ? (
          searchBar
        ) : (
          <p className="geofence-modal-step-label">Edit work zone</p>
        )}
        <button type="button" className="geofence-modal-close" onClick={handleClose} aria-label="Close">
          ×
        </button>
      </div>

      {showEditSplit ? (
        <div className="geofence-edit-layout">
          <aside className="geofence-edit-sidebar">
            <div className="geofence-sidebar-block">
              <h3 className="geofence-sidebar-heading">Zone details</h3>
              <p className="geofence-sidebar-sub">Address and branch settings</p>
            </div>

            <div className="geofence-address-block geofence-address-block--sidebar">
              <h4 className="geofence-address-heading">Address</h4>
              {addressLoading ? (
                <p className="geofence-address-loading">Updating address…</p>
              ) : (
                <>
                  <div className="geofence-address-row geofence-address-row--stacked">
                    <span className="geofence-address-label">Full address</span>
                    <span className="geofence-address-value">{formatted || '—'}</span>
                  </div>
                  <div className="geofence-address-row geofence-address-row--stacked">
                    <span className="geofence-address-label">Region / city</span>
                    <span className="geofence-address-value">{parts.region_line || '—'}</span>
                  </div>
                  <div className="geofence-address-row geofence-address-row--stacked">
                    <span className="geofence-address-label">Street</span>
                    <span className="geofence-address-value">{parts.street_line || '—'}</span>
                  </div>
                </>
              )}
            </div>

            <div className="geofence-sidebar-fields">
              <label className="geofence-field">
                <span>Branch</span>
                <select value={zoneBranchId} onChange={(e) => setZoneBranchId(e.target.value)} required>
                  <option value="">Select branch…</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="geofence-field">
                <span>Zone name</span>
                <input
                  type="text"
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  placeholder="e.g. Highway Grill — Main"
                />
              </label>
              <div className="geofence-coords">
                <span className="geofence-address-label">Coordinates</span>
                <span className="geofence-address-value">
                  {circleCenter[0].toFixed(5)}, {circleCenter[1].toFixed(5)}
                </span>
              </div>
            </div>

            <button type="button" className="btn btn-ghost geofence-sidebar-relocate" onClick={startRelocate}>
              Change location on map
            </button>
          </aside>

          <div className="geofence-edit-gis">
            <div className="geofence-gis-label">
              <span>Map & check-in area</span>
              <span className="geofence-gis-radius">{radiusM} m radius</span>
            </div>
            {mapStack}
          </div>
        </div>
      ) : (
        <>
          {mapStack}
          {!isEditMode && (
            <p className="geofence-hint geofence-hint--below-map">
              Pan to your site, adjust the check-in area on the map, then save.
            </p>
          )}
          {relocating && (
            <p className="geofence-hint geofence-hint--below-map">
              Search or pan to the new location, then save or go back to details.
            </p>
          )}
        </>
      )}

      {error && <p className="geofence-error">{error}</p>}
    </Modal>
  )
}
