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
  meta: Record<string, unknown> | null
  created_at: string
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

export function SecurityRegistrationLogsPage() {
  const [rows, setRows] = useState<AuthEvent[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await api<AuthEvent[]>('/security/registration-logs?limit=200'))
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
        title="Registration logs"
        subtitle="Crew sign-ups and HR approve / reject / activate decisions."
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            Refresh
          </button>
        }
      />

      {loading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <EmptyState title="No registration events" description="New registrations will appear here." />
      ) : (
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>Email</th>
                <th>IP</th>
                <th>Details</th>
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
                  <td>
                    {row.meta?.emp_number
                      ? `Emp # ${String(row.meta.emp_number)}`
                      : row.meta?.reason
                        ? String(row.meta.reason)
                        : '—'}
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
