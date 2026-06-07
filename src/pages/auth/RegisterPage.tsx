import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api, ApiError } from '../../lib/api'
import { register } from '../../lib/auth'
import { useAuth } from '../../context/AuthContext'
import { DatePicker } from '../../components/DatePicker'
import { AddressField } from '../../components/AddressField'
import { NationalityField, DEFAULT_NATIONALITY } from '../../components/NationalityField'
import type { Branch, Gender, Position } from '../../types/hrms'

const GENDER_OPTIONS: { value: Gender | ''; label: string }[] = [
  { value: '', label: 'Select…' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not', label: 'Prefer not to say' },
]

const emptyForm = () => ({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  password: '',
  confirm: '',
  branch_id: '',
  position_id: '',
  date_of_birth: '',
  gender: '' as Gender | '',
  nationality: DEFAULT_NATIONALITY,
  address: '',
  emergency_name: '',
  emergency_phone: '',
  employment_type: 'full_time',
})

export function RegisterPage() {
  const { user, loading } = useAuth()
  const [branches, setBranches] = useState<Branch[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadOptions = async (branchId: string, pickDefaultBranch = false) => {
    const q = branchId ? `?branch_id=${encodeURIComponent(branchId)}` : ''
    const data = await api<{ branches: Branch[]; positions: Position[] }>(`/auth/register-options${q}`)
    setBranches(data.branches)
    setPositions(data.positions ?? [])
    if (pickDefaultBranch && data.branches[0]) {
      setForm((f) => ({ ...f, branch_id: f.branch_id || data.branches[0].id }))
    }
  }

  useEffect(() => {
    loadOptions('', true).catch(() => setError('Could not load registration options.'))
  }, [])

  useEffect(() => {
    if (!form.branch_id) return
    loadOptions(form.branch_id).catch(() => setPositions([]))
  }, [form.branch_id])

  if (!loading && user) {
    return <Navigate to="/" replace />
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (form.password !== form.confirm) {
      setError('Passwords do not match')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (!form.position_id) {
      setError('Please select the position you are applying for')
      return
    }
    const selected = positions.find((p) => p.id === form.position_id)
    setSubmitting(true)
    try {
      const result = await register({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        branch_id: form.branch_id,
        position_id: form.position_id,
        department_id: selected?.department_id,
        date_of_birth: form.date_of_birth || undefined,
        gender: form.gender || undefined,
        nationality: form.nationality || DEFAULT_NATIONALITY,
        address: form.address || undefined,
        emergency_name: form.emergency_name || undefined,
        emergency_phone: form.emergency_phone || undefined,
        employment_type: form.employment_type,
      })
      setSuccess(result.message)
      setForm({ ...emptyForm(), branch_id: form.branch_id })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-card card" style={{ maxWidth: 520 }}>
      <h1>Join Highway Grill</h1>
      <p className="login-sub">
        Apply as restaurant or cafe staff. HR will review your details and notify you when you can sign in.
      </p>

      {success ? (
        <div className="card" style={{ background: 'var(--surface-2)', marginBottom: '1rem' }}>
          <p style={{ margin: 0 }}>{success}</p>
          <p className="muted-block" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            After approval, sign in and complete your profile photo under Profile.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="first_name">First name</label>
              <input
                id="first_name"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="last_name">Last name</label>
              <input
                id="last_name"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reg_email">Email (login)</label>
            <input
              id="reg_email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="phone">Phone</label>
              <input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="branch">Branch</label>
              <select
                id="branch"
                value={form.branch_id}
                onChange={(e) => setForm({ ...form, branch_id: e.target.value, position_id: '' })}
                required
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="position">Position applying for</label>
            <select
              id="position"
              value={form.position_id}
              onChange={(e) => setForm({ ...form, position_id: e.target.value })}
              required
            >
              <option value="">Select position…</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.department_name ? `${p.department_name} — ` : ''}{p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <DatePicker
              label="Date of birth"
              value={form.date_of_birth}
              onChange={(date_of_birth) => setForm({ ...form, date_of_birth })}
              max={new Date().toISOString().slice(0, 10)}
              birthDate
            />
            <div className="form-group">
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
          </div>

          <NationalityField
            value={form.nationality}
            onChange={(nationality) => setForm({ ...form, nationality })}
          />

          <AddressField
            label="Home address"
            value={form.address}
            onChange={(address) => setForm({ ...form, address })}
            compact
          />

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

          <div className="form-group">
            <label>Employment type</label>
            <select
              value={form.employment_type}
              onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
            >
              <option value="full_time">Full time</option>
              <option value="part_time">Part time</option>
              <option value="casual">Casual</option>
              <option value="seasonal">Seasonal</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="reg_password">Password</label>
              <input
                id="reg_password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirm">Confirm password</label>
              <input
                id="confirm"
                type="password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit application'}
          </button>
        </form>
      )}

      <p className="login-hint" style={{ marginTop: '1rem' }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  )
}
