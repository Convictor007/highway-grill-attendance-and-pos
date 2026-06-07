import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { api, apiUpload } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { hasPermission } from '../../lib/auth'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmployeeAvatar } from '../../components/EmployeeAvatar'
import { DatePicker } from '../../components/DatePicker'
import { NationalityField, DEFAULT_NATIONALITY } from '../../components/NationalityField'
import { ProfileAddressCard } from '../../components/ProfileAddressCard'
import type { Employee, Gender } from '../../types/hrms'

const GENDER_OPTIONS: { value: Gender | ''; label: string }[] = [
  { value: '', label: 'Select…' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not', label: 'Prefer not to say' },
]

function genderLabel(g?: string | null) {
  return GENDER_OPTIONS.find((o) => o.value === g)?.label ?? '—'
}

function formatLongDate(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function calcAge(iso?: string | null): number | null {
  if (!iso) return null
  const born = new Date(`${iso.slice(0, 10)}T12:00:00`)
  const today = new Date()
  let age = today.getFullYear() - born.getFullYear()
  const m = today.getMonth() - born.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < born.getDate())) age--
  return age >= 0 ? age : null
}

function SectionCard({
  icon,
  iconClass,
  title,
  children,
}: {
  icon: React.ReactNode
  iconClass: string
  title: string
  children: ReactNode
}) {
  return (
    <section className="profile-section-card card">
      <header className="profile-section-card__head">
        <span className={`profile-section-card__icon ${iconClass}`} aria-hidden>
          {icon}
        </span>
        <h3 className="profile-section-card__title">{title}</h3>
      </header>
      <div className="profile-section-card__body">{children}</div>
    </section>
  )
}

export function ProfilePage() {
  const { user, refresh } = useAuth()
  const canEdit = hasPermission(user, 'profile.edit.self')
  const fileRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<Employee | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    phone: '',
    email: '',
    address: '',
    date_of_birth: '',
    gender: '' as Gender | '',
    nationality: DEFAULT_NATIONALITY,
    emergency_name: '',
    emergency_phone: '',
  })
  const [saved, setSaved] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [saving, setSaving] = useState(false)

  const resetForm = (me: Employee) => {
    setForm({
      phone: me.phone ?? '',
      email: me.email ?? '',
      address: me.address ?? '',
      date_of_birth: me.date_of_birth?.slice(0, 10) ?? '',
      gender: (me.gender as Gender) ?? '',
      nationality: me.nationality || DEFAULT_NATIONALITY,
      emergency_name: me.emergency_name ?? '',
      emergency_phone: me.emergency_phone ?? '',
    })
  }

  const load = async () => {
    const me = await api<Employee>('/employees/me')
    setProfile(me)
    resetForm(me)
  }

  useEffect(() => {
    load()
  }, [])

  const cancelEdit = () => {
    if (profile) resetForm(profile)
    setEditing(false)
  }

  const onSave = async (e?: FormEvent) => {
    e?.preventDefault()
    setSaving(true)
    try {
      await api('/employees/me', {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          gender: form.gender || null,
          date_of_birth: form.date_of_birth || null,
          nationality: form.nationality || DEFAULT_NATIONALITY,
        }),
      })
      setSaved(true)
      setEditing(false)
      await load()
      await refresh()
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const onPhoto = async (file: File | undefined) => {
    if (!file) return
    setPhotoBusy(true)
    try {
      const fd = new FormData()
      fd.append('photo', file)
      await apiUpload<Employee>('/employees/me/photo', fd)
      await load()
      await refresh()
    } finally {
      setPhotoBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (!profile) return <LoadingBlock />

  const age = calcAge(profile.date_of_birth)
  const isActive = profile.status === 'active'

  return (
    <div className="profile-page">
      <div className="profile-layout">
        <div className="profile-col profile-col--side">
          <section className="profile-identity card">
            <div className="profile-identity__avatar">
              <EmployeeAvatar
                photoUrl={profile.photo_url}
                firstName={profile.first_name}
                lastName={profile.last_name}
                size={88}
              />
              {canEdit && editing && (
                <button
                  type="button"
                  className="profile-identity__upload"
                  disabled={photoBusy}
                  onClick={() => fileRef.current?.click()}
                >
                  {photoBusy ? 'Uploading…' : 'Upload photo'}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                onChange={(e) => onPhoto(e.target.files?.[0])}
              />
            </div>

            <h1 className="profile-identity__name">
              {profile.first_name} {profile.last_name}
            </h1>
            <p className="profile-identity__account">Employee Account</p>
            <p className="profile-identity__email">{profile.email ?? user?.email ?? '—'}</p>

            <div className="profile-identity__badge-row">
              <span className={`profile-verified-badge${isActive ? '' : ' profile-verified-badge--muted'}`}>
                {isActive ? '✓ Verified' : profile.status}
              </span>
            </div>

            {canEdit && (
              <div className="profile-identity__actions">
                {!editing ? (
                  <button type="button" className="btn btn-primary btn-block" onClick={() => setEditing(true)}>
                    Edit profile
                  </button>
                ) : (
                  <div className="profile-identity__edit-actions">
                    <button type="button" className="btn btn-ghost" onClick={cancelEdit} disabled={saving}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => onSave()} disabled={saving}>
                      {saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="profile-status-card card">
            <header className="profile-status-card__head">
              <span className="profile-status-card__icon" aria-hidden>🛡</span>
              <h3>Employment status</h3>
            </header>
            <p className="profile-status-card__text">
              {isActive
                ? `You are an active employee at ${profile.branch_name ?? 'your branch'}.`
                : `Your employment status is ${profile.status}. Contact HR if you need assistance.`}
            </p>
            <p className="profile-status-card__meta">
              {profile.emp_number} · {profile.position_title ?? 'Staff'}
            </p>
          </section>
        </div>

        <div className="profile-col profile-col--main">
          <div className="profile-stats-row card">
            <div className="profile-stat">
              <span className="profile-stat__label">Age</span>
              <span className="profile-stat__value">{age ?? '—'}</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat__label">Role</span>
              <span className="profile-stat__value">{profile.position_title ?? 'Staff'}</span>
            </div>
          </div>

          <SectionCard
            iconClass="profile-section-card__icon--person"
            title="Personal Information"
            icon={
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            }
          >
            {!editing ? (
              <div className="profile-fields">
                <div className="profile-field">
                  <span className="profile-field__label">First name</span>
                  <span className="profile-field__value">{profile.first_name}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-field__label">Last name</span>
                  <span className="profile-field__value">{profile.last_name}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-field__label">Gender</span>
                  <span className="profile-field__value">{genderLabel(profile.gender)}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-field__label">Date of birth</span>
                  <span className="profile-field__value">
                    {profile.date_of_birth?.slice(0, 10) ?? '—'}
                    {profile.date_of_birth && (
                      <span className="profile-field__sub">{formatLongDate(profile.date_of_birth)}</span>
                    )}
                  </span>
                </div>
                <div className="profile-field">
                  <span className="profile-field__label">Nationality</span>
                  <span className="profile-field__value">{profile.nationality || DEFAULT_NATIONALITY}</span>
                </div>
              </div>
            ) : (
              <div className="profile-form-fields">
                <div className="profile-form-row">
                  <div className="form-group profile-form-group">
                    <label>First name</label>
                    <input value={profile.first_name} disabled className="profile-input--readonly" />
                  </div>
                  <div className="form-group profile-form-group">
                    <label>Last name</label>
                    <input value={profile.last_name} disabled className="profile-input--readonly" />
                  </div>
                </div>
                <div className="profile-form-row">
                  <div className="form-group profile-form-group">
                    <label>Gender</label>
                    <select
                      value={form.gender}
                      onChange={(e) => setForm({ ...form, gender: e.target.value as Gender | '' })}
                    >
                      {GENDER_OPTIONS.map((o) => (
                        <option key={o.label} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <DatePicker
                    label="Date of birth"
                    value={form.date_of_birth}
                    onChange={(date_of_birth) => setForm({ ...form, date_of_birth })}
                    max={new Date().toISOString().slice(0, 10)}
                    birthDate
                  />
                </div>
                {form.date_of_birth && (
                  <p className="profile-dob-hint">{formatLongDate(form.date_of_birth)}</p>
                )}
                <NationalityField
                  value={form.nationality}
                  onChange={(nationality) => setForm({ ...form, nationality })}
                />
              </div>
            )}
          </SectionCard>

          <SectionCard
            iconClass="profile-section-card__icon--phone"
            title="Contact Details"
            icon={
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.07 21 3 13.93 3 5a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.25 1.01l-2.2 2.21z" />
              </svg>
            }
          >
            {!editing ? (
              <div className="profile-contact-grid">
                <div className="profile-contact-item">
                  <span className="profile-field__label">Email address</span>
                  <span className="profile-field__value">{profile.email ?? '—'}</span>
                </div>
                <div className="profile-contact-item">
                  <span className="profile-field__label">Phone number</span>
                  <span className="profile-field__value">{profile.phone ?? '—'}</span>
                </div>
                <div className="profile-contact-item profile-contact-item--full">
                  <span className="profile-field__label">Emergency contact</span>
                  <span className="profile-field__value">
                    {profile.emergency_name
                      ? `${profile.emergency_name}${profile.emergency_phone ? ` · ${profile.emergency_phone}` : ''}`
                      : '—'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="profile-form-fields">
                <div className="profile-form-row">
                  <div className="form-group profile-form-group">
                    <label>Email address</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group profile-form-group">
                    <label>Phone number</label>
                    <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>
                <div className="profile-form-row">
                  <div className="form-group profile-form-group">
                    <label>Emergency contact</label>
                    <input
                      value={form.emergency_name}
                      onChange={(e) => setForm({ ...form, emergency_name: e.target.value })}
                    />
                  </div>
                  <div className="form-group profile-form-group">
                    <label>Emergency phone</label>
                    <input
                      value={form.emergency_phone}
                      onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          <ProfileAddressCard
            value={editing ? form.address : (profile.address ?? '')}
            onChange={editing && canEdit ? (address) => setForm({ ...form, address }) : undefined}
            disabled={!editing || !canEdit}
          />

          {!editing && (
            <section className="profile-section-card card">
              <header className="profile-section-card__head">
                <span className="profile-section-card__icon profile-section-card__icon--work" aria-hidden>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z" />
                  </svg>
                </span>
                <h3 className="profile-section-card__title">Work Information</h3>
              </header>
              <div className="profile-section-card__body">
                <div className="profile-contact-grid">
                  <div className="profile-contact-item">
                    <span className="profile-field__label">Department</span>
                    <span className="profile-field__value">{profile.department_name ?? '—'}</span>
                  </div>
                  <div className="profile-contact-item">
                    <span className="profile-field__label">Branch</span>
                    <span className="profile-field__value">{profile.branch_name ?? '—'}</span>
                  </div>
                  <div className="profile-contact-item">
                    <span className="profile-field__label">Hire date</span>
                    <span className="profile-field__value">{profile.hire_date?.slice(0, 10) ?? '—'}</span>
                  </div>
                  <div className="profile-contact-item">
                    <span className="profile-field__label">Employment</span>
                    <span className="profile-field__value">
                      {(profile.employment_type ?? '').replace(/_/g, ' ') || '—'}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
