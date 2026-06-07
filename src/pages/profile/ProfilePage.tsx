import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { hasPermission } from '../../lib/auth'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import type { Employee } from '../../types/hrms'

export function ProfilePage() {
  const { user } = useAuth()
  const canEdit = hasPermission(user, 'profile.edit.self')
  const [profile, setProfile] = useState<Employee | null>(null)
  const [form, setForm] = useState({
    phone: '',
    email: '',
    address: '',
    emergency_name: '',
    emergency_phone: '',
  })
  const [saved, setSaved] = useState(false)

  const load = async () => {
    const me = await api<Employee>('/employees/me')
    setProfile(me)
    setForm({
      phone: me.phone ?? '',
      email: me.email ?? '',
      address: me.address ?? '',
      emergency_name: me.emergency_name ?? '',
      emergency_phone: me.emergency_phone ?? '',
    })
  }

  useEffect(() => {
    load()
  }, [])

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    await api('/employees/me', { method: 'PUT', body: JSON.stringify(form) })
    setSaved(true)
    load()
    setTimeout(() => setSaved(false), 2000)
  }

  if (!profile) return <LoadingBlock />

  return (
    <div>
      <PageHeader title="My profile" subtitle={`${profile.emp_number} · ${profile.position_title ?? 'Staff'}`} />

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="section-title">Job info</h3>
        <dl className="profile-dl">
          <dt>Name</dt>
          <dd>{profile.first_name} {profile.last_name}</dd>
          <dt>Branch</dt>
          <dd>{profile.branch_name}</dd>
          <dt>Department</dt>
          <dd>{profile.department_name ?? '—'}</dd>
          <dt>Position</dt>
          <dd>{profile.position_title ?? '—'}</dd>
          <dt>Hire date</dt>
          <dd>{profile.hire_date?.slice(0, 10)}</dd>
          <dt>Status</dt>
          <dd><span className={`badge badge-${profile.status}`}>{profile.status}</span></dd>
        </dl>
      </div>

      {canEdit && (
        <form className="card" style={{ marginBottom: '1.5rem' }} onSubmit={onSave}>
          <h3 className="section-title">Contact & emergency</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Address</label>
            <textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Emergency contact</label>
              <input value={form.emergency_name} onChange={(e) => setForm({ ...form, emergency_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Emergency phone</label>
              <input value={form.emergency_phone} onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">{saved ? 'Saved' : 'Save changes'}</button>
        </form>
      )}
    </div>
  )
}
