import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmptyState } from '../../components/EmptyState'

interface OvertimeRequest {
  id: string
  request_date: string
  extra_hours: string
  reason: string | null
  status: string
  source?: string
  first_name?: string
  last_name?: string
  emp_number?: string
}

export function HrOvertimePage() {
  const [rows, setRows] = useState<OvertimeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pending' | 'history'>('pending')

  const load = async () => {
    setLoading(true)
    try {
      setRows(await api<OvertimeRequest[]>('/overtime/requests'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const review = async (id: string, status: 'approved' | 'rejected') => {
    await api(`/overtime/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
    load()
  }

  const pending = rows.filter((r) => r.status === 'pending')
  const history = rows.filter((r) => r.status !== 'pending')

  const renderRow = (r: OvertimeRequest, showActions: boolean) => (
    <tr key={r.id}>
      <td>
        {r.first_name} {r.last_name}
        <br />
        <small style={{ color: 'var(--muted)' }}>{r.emp_number}</small>
      </td>
      <td>{r.request_date}</td>
      <td>{r.extra_hours}</td>
      <td>
        <span className={`badge badge-${r.source === 'auto' ? 'processing' : 'approved'}`}>
          {r.source === 'auto' ? 'Auto' : 'Manual'}
        </span>
      </td>
      <td>{r.reason ?? '—'}</td>
      {showActions ? (
        <td>
          <div className="quick-actions" style={{ margin: 0 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => review(r.id, 'approved')}>
              Approve
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => review(r.id, 'rejected')}>
              Reject
            </button>
          </div>
        </td>
      ) : (
        <td>
          <span className={`badge badge-${r.status === 'approved' ? 'approved' : 'pending'}`}>{r.status}</span>
        </td>
      )}
    </tr>
  )

  return (
    <div>
      <PageHeader
        title="Overtime"
        subtitle="Auto-detected from attendance (9h cap & past shift end). HR can approve or correct."
      />

      <div className="tabs" style={{ marginBottom: '1rem' }}>
        <button type="button" className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
          Pending ({pending.length})
        </button>
        <button type="button" className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          History ({history.length})
        </button>
      </div>

      <div className="card table-wrap">
        {loading ? (
          <LoadingBlock />
        ) : tab === 'pending' ? (
          pending.length === 0 ? (
            <EmptyState title="No pending overtime" description="Auto-detected overtime appears here after clock-out." />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Hours</th>
                  <th>Source</th>
                  <th>Reason</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>{pending.map((r) => renderRow(r, true))}</tbody>
            </table>
          )
        ) : history.length === 0 ? (
          <EmptyState title="No history yet" description="Approved and rejected overtime requests appear here." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Hours</th>
                <th>Source</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>{history.map((r) => renderRow(r, false))}</tbody>
          </table>
        )}
      </div>
    </div>
  )
}