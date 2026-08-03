import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmptyState } from '../../components/EmptyState'
import { api } from '../../lib/api'

type AuthEvent = {
  id: string
  event_type: string
  email: string | null
  ip_address: string | null
  user_agent: string | null
  threat_level: string
  created_at: string
  role_slug?: string | null
  role_name?: string | null
}

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

function labelEvent(type: string) {
  return type.replace(/_/g, ' ')
}

export function SecurityAuthLogsPage() {
  const [rows, setRows] = useState<AuthEvent[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await api<AuthEvent[]>('/security/auth-logs?limit=200'))
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <PageHeader
        title="Auth logs"
        subtitle="Login, logout, and failed sign-in attempts with IP address."
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            Refresh
          </button>
        }
      />

      {loading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <EmptyState title="No auth events" description="Events appear after logins and failed attempts." />
      ) : (
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>Email</th>
                <th>IP</th>
                <th>Role</th>
                <th>Threat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatWhen(row.created_at)}</td>
                  <td className="text-capitalize">{labelEvent(row.event_type)}</td>
                  <td>{row.email || '—'}</td>
                  <td>
                    <code>{row.ip_address || '—'}</code>
                  </td>
                  <td>{row.role_name || row.role_slug || '—'}</td>
                  <td>
                    {row.threat_level !== 'none' ? (
                      <span className={`badge threat-${row.threat_level}`}>{row.threat_level}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
