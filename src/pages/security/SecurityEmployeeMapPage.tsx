import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmptyState } from '../../components/EmptyState'
import { MapCenterPin } from '../../components/MapCenterPin'
import type { MapMarker } from '../../components/mapTypes'
import { api } from '../../lib/api'

type LiveLocation = {
  user_id: string
  employee_id: string | null
  emp_number: string | null
  first_name: string | null
  last_name: string | null
  email: string
  branch_name: string | null
  latitude: number
  longitude: number
  accuracy_m: number | null
  recorded_at: string
  minutes_ago: number
  is_live: boolean
  is_clocked_in: boolean
}

const DEFAULT_CENTER: [number, number] = [15.1458, 120.5906]
const POLL_MS = 30_000

function formatWhen(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(String(iso).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SecurityEmployeeMapPage() {
  const [rows, setRows] = useState<LiveLocation[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setRows(await api<LiveLocation[]>('/security/live-locations'))
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), POLL_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const markers: MapMarker[] = useMemo(
    () =>
      rows
        .filter((r) => Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude)))
        .map((r) => ({
          id: r.user_id,
          lat: Number(r.latitude),
          lng: Number(r.longitude),
          label: `${r.first_name || r.email} ${r.last_name || ''}`.trim()
            + (r.is_live ? ' · online' : ` · ${Math.round(r.minutes_ago || 0)}m ago`),
          kind: r.is_live ? 'you' : 'checkin',
        })),
    [rows],
  )

  const center: [number, number] = markers[0]
    ? [markers[0].lat, markers[0].lng]
    : DEFAULT_CENTER

  const liveCount = rows.filter((r) => r.is_live).length

  return (
    <div>
      <PageHeader
        title="Employee map"
        subtitle={`${liveCount} online · ${rows.length} devices · refreshes every 30s`}
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            Refresh
          </button>
        }
      />

      {loading ? (
        <LoadingBlock />
      ) : (
        <>
          <div className="card" style={{ marginBottom: '1rem', padding: 0, overflow: 'hidden' }}>
            <MapCenterPin
              key={markers.map((m) => m.id).join(',') || 'empty'}
              initialCenter={center}
              zoom={markers.length ? 13 : 12}
              markers={markers}
              fitMarkers={markers.length > 0}
              showBasemapSwitcher
              light
              className="map-center-pin-wrap security-live-map"
              skipInitialCenterEmit
            />
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title="No devices reporting"
              description="Users must be logged in on the mobile app with location permission."
            />
          ) : (
            <div className="card table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Emp #</th>
                    <th>Branch</th>
                    <th>Status</th>
                    <th>Accuracy</th>
                    <th>Last ping</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.user_id}>
                      <td>
                        {row.first_name || row.email} {row.last_name || ''}
                      </td>
                      <td>{row.emp_number || '—'}</td>
                      <td>{row.branch_name || '—'}</td>
                      <td>
                        {row.is_live ? 'Online' : `Last seen ${Math.round(row.minutes_ago || 0)}m`}
                        {row.is_clocked_in ? ' · Clocked in' : ''}
                      </td>
                      <td>{row.accuracy_m != null ? `±${Math.round(row.accuracy_m)}m` : '—'}</td>
                      <td>{formatWhen(row.recorded_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
