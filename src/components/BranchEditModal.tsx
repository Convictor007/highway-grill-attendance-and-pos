import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import { Modal } from './Modal'
import { MapCenterPin } from './MapCenterPin'
import {
  emptyParts,
  reverseGeocode,
  searchAddress,
  useDebouncedGeocode,
  type AddressParts,
  type GeocodeResult,
} from '../lib/geocode'
import { branchMapCenter } from '../lib/branchMapCenter'

export type BranchEditInput = {
  id: string
  name: string
  address: string | null
  phone: string | null
  timezone?: string
  is_active: number | boolean
  default_latitude?: string | number | null
  default_longitude?: string | number | null
}

type Props = {
  open: boolean
  branch: BranchEditInput | null
  onClose: () => void
  onSaved: () => void
}

const DEFAULT_CENTER: [number, number] = [14.5547, 121.0244]

function coordsFromBranch(branch: BranchEditInput | null): [number, number] {
  if (!branch) return DEFAULT_CENTER
  const lat = Number(branch.default_latitude)
  const lng = Number(branch.default_longitude)
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng]
  return branchMapCenter(branch.id, [branch], [], DEFAULT_CENTER)
}

export function BranchEditModal({ open, branch, onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [timezone, setTimezone] = useState('Asia/Manila')
  const [isActive, setIsActive] = useState(true)
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER)
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null)
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
  const initIdRef = useRef<string | null>(null)
  const addressEditedRef = useRef(false)
  const runGeocode = useMemo(() => useDebouncedGeocode(400), [])

  const applyGeocode = useCallback((r: GeocodeResult) => {
    const display = r.formatted || r.short
    setParts(r.parts ?? emptyParts())
    setFormatted(display)
    if (!addressEditedRef.current) {
      setAddress(display)
    }
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

  useEffect(() => {
    if (!open || !branch) {
      initIdRef.current = null
      return
    }
    if (initIdRef.current === branch.id) return
    initIdRef.current = branch.id
    addressEditedRef.current = false

    const coords = coordsFromBranch(branch)
    setName(branch.name)
    setAddress('')
    setPhone(branch.phone ?? '')
    setTimezone(branch.timezone ?? 'Asia/Manila')
    setIsActive(!!branch.is_active)
    setMapCenter(coords)
    panCenterRef.current = coords
    setFlyTo(coords)
    setFormatted('')
    setParts(emptyParts())
    setSearchQuery('')
    setSearchResults([])
    setShowResults(false)
    setError(null)
    fetchAddress(coords[0], coords[1])
  }, [open, branch, fetchAddress])

  useEffect(() => {
    if (!open || searchQuery.trim().length < 3) {
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
  }, [open, searchQuery])

  const handleMapPan = useCallback(
    (lat: number, lng: number) => {
      panCenterRef.current = [lat, lng]
      setMapCenter([lat, lng])
      addressEditedRef.current = false
      fetchAddress(lat, lng)
    },
    [fetchAddress]
  )

  const pickSearchResult = (r: GeocodeResult) => {
    const coords: [number, number] = [r.latitude, r.longitude]
    panCenterRef.current = coords
    setMapCenter(coords)
    setFlyTo(coords)
    addressEditedRef.current = false
    applyGeocode(r)
    setSearchQuery(r.short || r.formatted)
    setShowResults(false)
  }

  const save = async () => {
    if (!branch) return
    setError(null)
    if (!name.trim()) {
      setError('Branch name is required')
      return
    }

    const lat = mapCenter[0]
    const lng = mapCenter[1]
    panCenterRef.current = [lat, lng]

    setSaving(true)
    try {
      const geoText = formatted.trim()
      let resolvedAddress = address.trim() || geoText || undefined
      try {
        const geo = await reverseGeocode(lat, lng)
        if (geo.formatted) resolvedAddress = geo.formatted
      } catch {
        // keep typed or last geocoded address
      }

      await api(`/settings/branches/${branch.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim(),
          address: resolvedAddress,
          phone: phone.trim() || null,
          timezone,
          is_active: isActive,
          default_latitude: lat,
          default_longitude: lng,
        }),
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save branch')
    } finally {
      setSaving(false)
    }
  }

  if (!open || !branch) return null

  return (
    <Modal
      open={open}
      title={`Edit branch — ${branch.name}`}
      onClose={onClose}
      size="wide"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={saving || addressLoading} onClick={save}>
            {saving ? 'Saving…' : 'Save branch'}
          </button>
        </>
      }
      panelClassName="branch-edit-modal-panel"
    >
      <div className="branch-edit-layout">
        <div className="branch-edit-fields">
          <label className="geofence-field">
            <span>Name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="geofence-field">
            <span>Address</span>
            <input
              type="text"
              value={address}
              onChange={(e) => {
                addressEditedRef.current = true
                setAddress(e.target.value)
              }}
            />
          </label>
          <label className="geofence-field">
            <span>Phone</span>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="geofence-field">
            <span>Timezone</span>
            <input type="text" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </label>
          <label className="geofence-field geofence-field--checkbox">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>Active branch</span>
          </label>

          <div className="branch-edit-map-meta">
            <span className="geofence-address-label">Default map center</span>
            <span className="geofence-address-value">
              {mapCenter[0].toFixed(5)}, {mapCenter[1].toFixed(5)}
            </span>
            {addressLoading ? (
              <span className="geofence-address-loading">Updating address…</span>
            ) : (
              formatted && <span className="geofence-address-value">{formatted}</span>
            )}
            <p className="geofence-hint">
              Default map center for the branch clock-in zone. Pan the map or search to set it.
            </p>
          </div>
        </div>

        <div className="branch-edit-map">
          <div className="geofence-search-wrap">
            <div className="geofence-modal-search">
              <span className="geofence-modal-search-icon" aria-hidden>
                ⌕
              </span>
              <input
                type="search"
                className="geofence-modal-search-input"
                placeholder="Search branch location…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setShowResults(true)
                }}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                autoComplete="off"
              />
              {searching && <span className="geofence-modal-search-spinner">…</span>}
            </div>
            {showResults && searchResults.length > 0 && (
              <ul className="geofence-modal-suggestions" role="listbox">
                {searchResults.map((r, i) => (
                  <li key={`${r.latitude}-${r.longitude}-${i}`} role="option">
                    <button type="button" onClick={() => pickSearchResult(r)}>
                      <span className="geofence-suggestion-primary">{r.short || r.formatted}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <MapCenterPin
            key={branch.id}
            initialCenter={coordsFromBranch(branch)}
            flyTo={flyTo}
            zoom={15}
            onCenterChange={handleMapPan}
            onFlyToComplete={() => setFlyTo(null)}
            skipInitialCenterEmit
            showBasemapSwitcher
            defaultBasemap="streets"
            className="map-center-pin-wrap branch-edit-map-pin"
          />
        </div>
      </div>

      {error && <p className="geofence-error">{error}</p>}
    </Modal>
  )
}
