import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Modal } from './Modal'
import type { Branch } from '../types/hrms'

export type AnnouncementRecord = {
  id: string
  title: string
  body: string
  priority: string
  branch_id: string | null
  publish_at?: string | null
  expires_at?: string | null
}

type Props = {
  open: boolean
  announcement: AnnouncementRecord | null
  branches: Branch[]
  onClose: () => void
  onSaved: () => void
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toSql(local: string): string | null {
  if (!local) return null
  return local.replace('T', ' ') + (local.length === 16 ? ':00' : '')
}

export function AnnouncementEditModal({ open, announcement, branches, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    branch_id: '',
    title: '',
    body: '',
    priority: 'normal' as 'low' | 'normal' | 'urgent',
    publish_at: '',
    expires_at: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !announcement) return
    setForm({
      branch_id: announcement.branch_id ?? '',
      title: announcement.title,
      body: announcement.body,
      priority: (announcement.priority as typeof form.priority) || 'normal',
      publish_at: toLocalInput(announcement.publish_at),
      expires_at: toLocalInput(announcement.expires_at),
    })
    setError(null)
  }, [open, announcement])

  const save = async () => {
    if (!announcement) return
    setError(null)
    if (!form.title.trim() || !form.body.trim()) {
      setError('Title and body are required')
      return
    }

    setSaving(true)
    try {
      await api(`/announcements/${announcement.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          branch_id: form.branch_id || null,
          title: form.title.trim(),
          body: form.body.trim(),
          priority: form.priority,
          publish_at: toSql(form.publish_at),
          expires_at: toSql(form.expires_at),
        }),
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update memo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Edit memo"
      onClose={onClose}
      size="wide"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      {error && <p className="error-msg">{error}</p>}
      <div className="form-row">
        <div className="form-group">
          <label>Branch</label>
          <select
            value={form.branch_id}
            onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
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
            value={form.priority}
            onChange={(e) =>
              setForm({ ...form, priority: e.target.value as typeof form.priority })
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
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
      </div>
      <div className="form-group">
        <label>Body</label>
        <textarea
          rows={4}
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          required
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Publish at</label>
          <input
            type="datetime-local"
            value={form.publish_at}
            onChange={(e) => setForm({ ...form, publish_at: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>Expires at</label>
          <input
            type="datetime-local"
            value={form.expires_at}
            onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
          />
        </div>
      </div>
    </Modal>
  )
}
