import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmptyState } from '../../components/EmptyState'
import type { Branch } from '../../types/hrms'

interface Checklist {
  id: string
  name: string
  checklist_type: 'food_safety' | 'labor' | 'fire_safety' | 'health_permit'
  frequency: 'daily' | 'weekly' | 'monthly' | 'annual'
  due_day?: number | null
}

interface ComplianceLog {
  id: string
  checklist_name: string
  branch_name: string
  status: string
  completed_at: string
  notes: string | null
  first_name?: string
  last_name?: string
}

interface AuditEntry {
  id: string
  user_email: string | null
  action: string
  table_name: string | null
  record_id: string | null
  created_at: string
}

export function CompliancePage() {
  const [tab, setTab] = useState<'logs' | 'checklists' | 'audit'>('logs')
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [logs, setLogs] = useState<ComplianceLog[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    checklist_id: '',
    branch_id: '',
    status: 'compliant' as 'compliant' | 'non_compliant' | 'needs_action',
    notes: '',
  })
  const [checklistForm, setChecklistForm] = useState({
    name: '',
    checklist_type: 'labor' as Checklist['checklist_type'],
    frequency: 'monthly' as Checklist['frequency'],
    due_day: '',
  })

  const loadLogs = async () => {
    const [c, l, b] = await Promise.all([
      api<Checklist[]>('/compliance/checklists'),
      api<ComplianceLog[]>('/compliance/logs'),
      api<Branch[]>('/branches'),
    ])
    setChecklists(c)
    setLogs(l)
    setBranches(b)
    if (c[0] && !form.checklist_id) setForm((f) => ({ ...f, checklist_id: c[0].id }))
    if (b[0] && !form.branch_id) setForm((f) => ({ ...f, branch_id: b[0].id }))
  }

  const loadAudit = async () => {
    setAudit(await api<AuditEntry[]>('/compliance/audit?limit=150'))
  }

  const load = async () => {
    setLoading(true)
    try {
      await Promise.all([loadLogs(), loadAudit()])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await api('/compliance/logs', { method: 'POST', body: JSON.stringify(form) })
    setForm((f) => ({ ...f, notes: '' }))
    await loadLogs()
  }

  const onCreateChecklist = async (e: FormEvent) => {
    e.preventDefault()
    await api('/compliance/checklists', {
      method: 'POST',
      body: JSON.stringify({
        ...checklistForm,
        due_day: checklistForm.due_day ? Number(checklistForm.due_day) : null,
      }),
    })
    setChecklistForm({ name: '', checklist_type: 'labor', frequency: 'monthly', due_day: '' })
    await loadLogs()
  }

  const deleteChecklist = async (id: string, name: string) => {
    if (!confirm(`Delete checklist "${name}"?`)) return
    await api(`/compliance/checklists/${id}`, { method: 'DELETE' })
    await loadLogs()
  }

  return (
    <div>
      <PageHeader title="Compliance" subtitle="Checklists, inspection logs, and system audit trail" />

      <div className="tabs">
        <button type="button" className={`tab ${tab === 'logs' ? 'active' : ''}`} onClick={() => setTab('logs')}>
          Checklist logs
        </button>
        <button type="button" className={`tab ${tab === 'checklists' ? 'active' : ''}`} onClick={() => setTab('checklists')}>
          Checklists
        </button>
        <button type="button" className={`tab ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>
          Audit trail
        </button>
      </div>

      {loading && <LoadingBlock />}

      {!loading && tab === 'logs' && (
        <>
          <form className="card" style={{ marginBottom: '1.5rem' }} onSubmit={onSubmit}>
            <h3 className="section-title">Record checklist</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Checklist</label>
                <select
                  value={form.checklist_id}
                  onChange={(e) => setForm({ ...form, checklist_id: e.target.value })}
                  required
                >
                  {checklists.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.frequency})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Branch</label>
                <select
                  value={form.branch_id}
                  onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
                  required
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as typeof form.status })
                  }
                >
                  <option value="compliant">Compliant</option>
                  <option value="non_compliant">Non-compliant</option>
                  <option value="needs_action">Needs action</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary">
              Submit log
            </button>
          </form>

          <div className="card table-wrap">
            <h3 className="section-title">Recent logs</h3>
            {logs.length === 0 ? (
              <EmptyState title="No compliance logs" description="Submit a checklist result to get started." />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Checklist</th>
                    <th>Branch</th>
                    <th>Status</th>
                    <th>By</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{new Date(log.completed_at).toLocaleString()}</td>
                      <td>{log.checklist_name}</td>
                      <td>{log.branch_name}</td>
                      <td>
                        <span
                          className={`badge badge-${log.status === 'compliant' ? 'approved' : 'pending'}`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td>{log.first_name ? `${log.first_name} ${log.last_name}` : '—'}</td>
                      <td>{log.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {!loading && tab === 'checklists' && (
        <>
          <form className="card" style={{ marginBottom: '1.5rem' }} onSubmit={onCreateChecklist}>
            <h3 className="section-title">Add checklist</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Name</label>
                <input
                  value={checklistForm.name}
                  onChange={(e) => setChecklistForm({ ...checklistForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select
                  value={checklistForm.checklist_type}
                  onChange={(e) =>
                    setChecklistForm({
                      ...checklistForm,
                      checklist_type: e.target.value as Checklist['checklist_type'],
                    })
                  }
                >
                  <option value="food_safety">Food safety</option>
                  <option value="labor">Labor</option>
                  <option value="fire_safety">Fire safety</option>
                  <option value="health_permit">Health permit</option>
                </select>
              </div>
              <div className="form-group">
                <label>Frequency</label>
                <select
                  value={checklistForm.frequency}
                  onChange={(e) =>
                    setChecklistForm({
                      ...checklistForm,
                      frequency: e.target.value as Checklist['frequency'],
                    })
                  }
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              <div className="form-group">
                <label>Due day (optional)</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={checklistForm.due_day}
                  onChange={(e) => setChecklistForm({ ...checklistForm, due_day: e.target.value })}
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">
              Add checklist
            </button>
          </form>

          <div className="card table-wrap">
            <h3 className="section-title">Checklist templates</h3>
            {checklists.length === 0 ? (
              <EmptyState title="No checklists" description="Create a checklist template for your branches." />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Frequency</th>
                    <th>Due day</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {checklists.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.checklist_type}</td>
                      <td>{c.frequency}</td>
                      <td>{c.due_day ?? '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="text-link text-link--danger"
                          onClick={() => deleteChecklist(c.id, c.name)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {!loading && tab === 'audit' && (
        <div className="card table-wrap">
          <h3 className="section-title">System audit trail</h3>
          {audit.length === 0 ? (
            <EmptyState title="No audit entries" description="User actions across the system are logged here." />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Table</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.created_at.replace(' ', 'T')).toLocaleString()}</td>
                    <td>{row.user_email ?? '—'}</td>
                    <td>
                      <span className="badge badge-processing">{row.action}</span>
                    </td>
                    <td>{row.table_name ?? '—'}</td>
                    <td className="audit-record-id">{row.record_id ? row.record_id.slice(0, 8) + '…' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
