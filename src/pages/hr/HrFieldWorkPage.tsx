import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useNotification } from '../../hooks/useNotification'
import { hasPermission } from '../../lib/auth'
import { PageHeader } from '../../components/PageHeader'
import { GeofenceZoneModal, type GeofenceSiteInput } from '../../components/GeofenceZoneModal'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmptyState } from '../../components/EmptyState'

interface BranchCheckin {
  id: string
  latitude: string
  longitude: string
  address: string | null
  checked_in_at: string
  site_name: string | null
  first_name?: string
  last_name?: string
  notes: string | null
}

interface Branch {
  id: string
  name: string
  default_latitude?: string | null
  default_longitude?: string | null
}

export function HrFieldWorkPage() {
  const { user } = useAuth()
  const { success, error: notifyError, confirm } = useNotification()
  const canManage = hasPermission(user, 'attendance.manage')
  const [sites, setSites] = useState<GeofenceSiteInput[]>([])
  const [checkins, setCheckins] = useState<BranchCheckin[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSite, setEditingSite] = useState<GeofenceSiteInput | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    const [s, c, b] = await Promise.all([
      api<GeofenceSiteInput[]>('/field-work/sites'),
      api<BranchCheckin[]>('/field-work/checkins?limit=100'),
      api<Branch[]>('/branches'),
    ])
    setSites(s)
    setCheckins(c)
    setBranches(b)
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  const openAdd = () => {
    setEditingSite(null)
    setModalOpen(true)
  }

  const openEdit = (s: GeofenceSiteInput) => {
    setEditingSite(s)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingSite(null)
  }

  const removeZone = async (id: string) => {
    if (
      !(await confirm('Remove this work zone? Employees will no longer be able to check in inside it.', {
        variant: 'danger',
        confirmLabel: 'Remove',
      }))
    ) {
      return
    }
    setDeleting(true)
    try {
      await api(`/field-work/sites/${id}`, { method: 'DELETE' })
      success('Work zone removed')
      await load()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not remove work zone')
    } finally {
      setDeleting(false)
    }
  }

  const branchLabel = (branchId: string | null) =>
    branchId ? branches.find((b) => b.id === branchId)?.name ?? 'Branch' : 'Shared'

  return (
    <div>
      <PageHeader
        title="Field work"
        subtitle="Manage work zones and view crew check-ins. Use Add work zone to set location and area on the map."
      />

      <div className="card geofence-editor-card">
        <div className="geofence-toolbar">
          <h2 className="section-title">Work zones</h2>
          {canManage && (
            <button type="button" className="btn btn-primary" onClick={openAdd} disabled={loading}>
              + Add work zone
            </button>
          )}
        </div>

        {loading ? (
          <LoadingBlock />
        ) : sites.length === 0 ? (
          <EmptyState
            title="No zones yet"
            description="Add a work zone to pick a location on the map, confirm the address, and set branch and radius."
          />
        ) : (
          <ul className="field-site-list">
            {sites.map((s) => (
              <li key={s.id}>
                <strong>{s.name}</strong>
                <span>
                  {branchLabel(s.branch_id)} · {s.radius_m} m radius
                </span>
                {s.address && <span>{s.address}</span>}
                {canManage && (
                  <div className="geofence-list-actions">
                    <button type="button" className="text-link" onClick={() => openEdit(s)}>
                      Edit area
                    </button>
                    <button
                      type="button"
                      className="text-link text-link--danger"
                      disabled={deleting}
                      onClick={() => removeZone(s.id)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canManage && (
        <GeofenceZoneModal
          open={modalOpen}
          onClose={closeModal}
          onSaved={load}
          branches={branches}
          sites={sites}
          editingSite={editingSite}
        />
      )}

      <div className="card" style={{ marginTop: '1rem' }}>
        <h2 className="section-title">Recent check-ins</h2>
        {loading ? (
          <LoadingBlock />
        ) : checkins.length === 0 ? (
          <EmptyState title="No check-ins" description="Field check-ins from employees will appear here." />
        ) : (
          <ul className="field-checkin-list">
            {checkins.map((c) => (
              <li key={c.id} className="field-checkin-row">
                <div>
                  <strong>
                    {c.first_name} {c.last_name}
                  </strong>
                  {c.address && <span className="field-checkin-notes">{c.address}</span>}
                  <span className="field-checkin-time">
                    {c.site_name ?? 'Unknown zone'} · {new Date(c.checked_in_at.replace(' ', 'T')).toLocaleString()}
                  </span>
                  {c.notes && <span className="field-checkin-notes">{c.notes}</span>}
                </div>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=17/${c.latitude}/${c.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link"
                >
                  View on map
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
