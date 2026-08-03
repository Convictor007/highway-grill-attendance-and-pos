import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmptyState } from '../../components/EmptyState'
import { api } from '../../lib/api'

type Threat = {
  ip_address: string
  failed_logins: number
  rate_limited: number
  last_seen: string
  threat_level: string
  sample_email: string | null
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

export function SecurityThreatsPage() {
  const [rows, setRows] = useState<Threat[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await api<Threat[]>('/security/threats?window_minutes=120'))
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
        title="Threats"
        subtitle="Suspicious IPs from failed logins and rate limits (last 2 hours)."
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            Refresh
          </button>
        }
      />

      {loading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <EmptyState title="No active threats" description="No suspicious IP patterns in the current window." />
      ) : (
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>IP</th>
                <th>Level</th>
                <th>Failed logins</th>
                <th>Rate limited</th>
                <th>Sample email</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.ip_address}>
                  <td>
                    <code>{row.ip_address}</code>
                  </td>
                  <td>
                    <span className={`badge threat-${row.threat_level}`}>{row.threat_level}</span>
                  </td>
                  <td>{row.failed_logins}</td>
                  <td>{row.rate_limited}</td>
                  <td>{row.sample_email || '—'}</td>
                  <td>{formatWhen(row.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
