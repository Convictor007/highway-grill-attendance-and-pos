import { useEffect, useState, type FormEvent } from 'react'
import { api, apiUpload } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmptyState } from '../../components/EmptyState'
import { AnnouncementEditModal, type AnnouncementRecord } from '../../components/AnnouncementEditModal'
import type { Branch, Employee } from '../../types/hrms'

type AnnouncementRow = AnnouncementRecord & {
  branch_name?: string | null
}

interface DocumentRow {
  id: string
  employee_id: string
  category: string
  title: string
  file_url: string | null
  created_at: string
  first_name?: string
  last_name?: string
}

const DOC_CATEGORIES = ['contract', 'certificate', 'memo', 'id', 'other'] as const

export function HrContentPage() {
  const [tab, setTab] = useState<'memos' | 'documents'>('memos')
  const [loading, setLoading] = useState(true)
  const [branches, setBranches] = useState<Branch[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([])
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [memoForm, setMemoForm] = useState({
    branch_id: '',
    title: '',
    body: '',
    priority: 'normal' as 'low' | 'normal' | 'urgent',
  })
  const [docForm, setDocForm] = useState({
    employee_id: '',
    category: 'memo' as (typeof DOC_CATEGORIES)[number],
    title: '',
    file_url: '',
  })
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docEmployeeId, setDocEmployeeId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingMemo, setEditingMemo] = useState<AnnouncementRow | null>(null)

  const loadAnnouncements = async () => {
    setAnnouncements(await api<AnnouncementRow[]>('/announcements'))
  }

  const loadDocuments = async (employeeId: string) => {
    if (!employeeId) {
      setDocuments([])
      return
    }
    setDocuments(await api<DocumentRow[]>(`/documents?employee_id=${encodeURIComponent(employeeId)}`))
  }

  const load = async () => {
    setLoading(true)
    try {
      const [b, e] = await Promise.all([
        api<Branch[]>('/branches'),
        api<Employee[]>('/employees?status=active'),
      ])
      setBranches(b)
      setEmployees(e)
      if (b[0] && !memoForm.branch_id) setMemoForm((f) => ({ ...f, branch_id: b[0].id }))
      if (e[0] && !docEmployeeId) setDocEmployeeId(e[0].id)
      if (e[0] && !docForm.employee_id) setDocForm((f) => ({ ...f, employee_id: e[0].id }))
      await loadAnnouncements()
      if (e[0]) await loadDocuments(e[0].id)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const publishMemo = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await api('/announcements', {
        method: 'POST',
        body: JSON.stringify({
          branch_id: memoForm.branch_id || null,
          title: memoForm.title,
          body: memoForm.body,
          priority: memoForm.priority,
        }),
      })
      setMemoForm((f) => ({ ...f, title: '', body: '' }))
      await loadAnnouncements()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish memo')
    } finally {
      setBusy(false)
    }
  }

  const deleteMemo = async (row: AnnouncementRow) => {
    if (!confirm(`Delete memo "${row.title}"?`)) return
    setError(null)
    setBusy(true)
    try {
      await api(`/announcements/${row.id}`, { method: 'DELETE' })
      await loadAnnouncements()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete memo')
    } finally {
      setBusy(false)
    }
  }

  const uploadDocument = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (docFile) {
        const fd = new FormData()
        fd.append('employee_id', docForm.employee_id)
        fd.append('category', docForm.category)
        fd.append('title', docForm.title)
        fd.append('file', docFile)
        await apiUpload('/documents/upload', fd)
      } else {
        await api('/documents', {
          method: 'POST',
          body: JSON.stringify({
            employee_id: docForm.employee_id,
            category: docForm.category,
            title: docForm.title,
            file_url: docForm.file_url.trim() || undefined,
          }),
        })
      }
      setDocForm((f) => ({ ...f, title: '', file_url: '' }))
      setDocFile(null)
      await loadDocuments(docForm.employee_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add document')
    } finally {
      setBusy(false)
    }
  }

  const deleteDocument = async (id: string, title: string) => {
    if (!confirm(`Delete document "${title}"?`)) return
    setError(null)
    setBusy(true)
    try {
      await api(`/documents/${id}`, { method: 'DELETE' })
      await loadDocuments(docEmployeeId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete document')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="HR content" subtitle="Publish memos and assign employee documents" />

      <div className="tabs">
        <button type="button" className={`tab ${tab === 'memos' ? 'active' : ''}`} onClick={() => setTab('memos')}>
          Memos & notices
        </button>
        <button type="button" className={`tab ${tab === 'documents' ? 'active' : ''}`} onClick={() => setTab('documents')}>
          Documents
        </button>
      </div>

      {error && <p className="error-msg" style={{ marginBottom: '1rem' }}>{error}</p>}
      {loading && <LoadingBlock />}

      {!loading && tab === 'memos' && (
        <div className="stack">
          <form className="card" onSubmit={publishMemo}>
            <h3 className="section-title">Publish memo</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Branch</label>
                <select
                  value={memoForm.branch_id}
                  onChange={(e) => setMemoForm({ ...memoForm, branch_id: e.target.value })}
                >
                  <option value="">All branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select
                  value={memoForm.priority}
                  onChange={(e) =>
                    setMemoForm({ ...memoForm, priority: e.target.value as typeof memoForm.priority })
                  }
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Title</label>
              <input
                value={memoForm.title}
                onChange={(e) => setMemoForm({ ...memoForm, title: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Body</label>
              <textarea
                rows={4}
                value={memoForm.body}
                onChange={(e) => setMemoForm({ ...memoForm, body: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Publish
            </button>
          </form>

          <div className="card table-wrap">
            <h3 className="section-title">Published memos</h3>
            {announcements.length === 0 ? (
              <EmptyState title="No memos" description="Published announcements appear here." />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Branch</th>
                    <th>Title</th>
                    <th>Priority</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {announcements.map((a) => (
                    <tr key={a.id}>
                      <td>
                        {a.publish_at
                          ? new Date(a.publish_at.replace(' ', 'T')).toLocaleString()
                          : '—'}
                      </td>
                      <td>{a.branch_name ?? 'All'}</td>
                      <td>{a.title}</td>
                      <td>
                        <span className={`badge badge-${a.priority === 'urgent' ? 'pending' : 'approved'}`}>
                          {a.priority}
                        </span>
                      </td>
                      <td>
                        <div className="quick-actions" style={{ margin: 0 }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setEditingMemo(a)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => deleteMemo(a)}
                            disabled={busy}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {!loading && tab === 'documents' && (
        <div className="stack">
          <form className="card" onSubmit={uploadDocument}>
            <h3 className="section-title">Add document record</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Employee</label>
                <select
                  value={docForm.employee_id}
                  onChange={(e) => setDocForm({ ...docForm, employee_id: e.target.value })}
                  required
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.emp_number} — {emp.first_name} {emp.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Category</label>
                <select
                  value={docForm.category}
                  onChange={(e) =>
                    setDocForm({ ...docForm, category: e.target.value as typeof docForm.category })
                  }
                >
                  {DOC_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Title</label>
              <input
                value={docForm.title}
                onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Upload file</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {!docFile && (
              <div className="form-group">
                <label>Or file URL (optional)</label>
                <input
                  type="url"
                  placeholder="https://…"
                  value={docForm.file_url}
                  onChange={(e) => setDocForm({ ...docForm, file_url: e.target.value })}
                />
              </div>
            )}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Save document
            </button>
          </form>

          <div className="form-group" style={{ maxWidth: 360 }}>
            <label>View documents for</label>
            <select
              value={docEmployeeId}
              onChange={(e) => {
                setDocEmployeeId(e.target.value)
                loadDocuments(e.target.value)
              }}
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name}
                </option>
              ))}
            </select>
          </div>

          <div className="card table-wrap">
            <h3 className="section-title">Employee documents</h3>
            {documents.length === 0 ? (
              <EmptyState title="No documents" description="Add a document record for this employee." />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Added</th>
                    <th>Category</th>
                    <th>Title</th>
                    <th>Link</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {documents.map((d) => (
                    <tr key={d.id}>
                      <td>{new Date(d.created_at.replace(' ', 'T')).toLocaleDateString()}</td>
                      <td>{d.category}</td>
                      <td>{d.title}</td>
                      <td>
                        {d.file_url ? (
                          <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-link">
                            Open
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="text-link text-link--danger"
                          onClick={() => deleteDocument(d.id, d.title)}
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
        </div>
      )}
      <AnnouncementEditModal
        open={editingMemo != null}
        announcement={editingMemo}
        branches={branches}
        onClose={() => setEditingMemo(null)}
        onSaved={loadAnnouncements}
      />
    </div>
  )
}
