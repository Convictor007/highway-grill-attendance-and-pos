import { useEffect, useState, type FormEvent } from 'react'
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
  created_at: string
}

export function OvertimePage() {
  const [rows, setRows] = useState<OvertimeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    request_date: new Date().toISOString().slice(0, 10),
    extra_hours: '',
    reason: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const data = await api<OvertimeRequest[]>('/overtime/requests')
      setRows(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await api('/overtime/requests', {
      method: 'POST',
      body: JSON.stringify({
        request_date: form.request_date,
        extra_hours: Number(form.extra_hours),
        reason: form.reason || undefined,
      }),
    })
    setForm({
      request_date: new Date().toISOString().slice(0, 10),
      extra_hours: '',
      reason: '',
    })
    load()
  }

  return (
    <div>
      <PageHeader title="Overtime" subtitle="Request extra hours for HR approval" />

      <form className="card" onSubmit={onSubmit} style={{ marginBottom: '1rem' }}>
        <h2 className="section-title">New request</h2>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="ot-date">Date worked</label>
            <input
              id="ot-date"
              type="date"
              required
              value={form.request_date}
              onChange={(e) => setForm((f) => ({ ...f, request_date: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="ot-hours">Extra hours</label>
            <input
              id="ot-hours"
              type="number"
              min="0.5"
              max="12"
              step="0.5"
              required
              placeholder="e.g. 2"
              value={form.extra_hours}
              onChange={(e) => setForm((f) => ({ ...f, extra_hours: e.target.value }))}
            />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="ot-reason">Reason</label>
          <textarea
            id="ot-reason"
            rows={2}
            placeholder="Why overtime was needed"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Submit request
        </button>
      </form>

      <div className="card table-wrap">
        <h2 className="section-title">My requests</h2>
        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState title="No overtime requests" description="Submit a request when you work beyond your shift." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Hours</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.request_date}</td>
                  <td>{r.extra_hours}</td>
                  <td>{r.reason ?? '—'}</td>
                  <td>
                    <span className={`badge badge-${r.status}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
