import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Spinner } from '../../components/Spinner'
import { useAuth } from '../../context/AuthContext'
import { useNotification } from '../../hooks/useNotification'
import { ApiError } from '../../lib/api'
import { RoleSlug } from '../../types/roles'

const demos = [
  { label: 'Admin', email: 'admin@highwaygrill.local' },
  { label: 'HR', email: 'hr@highwaygrill.local' },
  { label: 'Employee', email: 'employee@highwaygrill.local' },
]

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const { error: notifyError } = useNotification()
  const navigate = useNavigate()
  const [email, setEmail] = useState('hr@highwaygrill.local')
  const [password, setPassword] = useState('dsadsadsa')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) {
    return <Navigate to={user.role_slug === RoleSlug.Admin ? '/admin' : '/'} replace />
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const loggedIn = await login(email, password)
      const dest = loggedIn.role_slug === RoleSlug.Admin ? '/admin' : '/'
      navigate(dest)
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-card card">
      <h1>Highway Grill HRMS</h1>
      <p className="login-sub">Sign in to manage your team</p>
      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
          {submitting ? (
            <>
              <Spinner size="sm" label="Signing in" />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>
      <div className="quick-actions" style={{ marginTop: '1rem', justifyContent: 'center' }}>
        {demos.map((d) => (
          <button
            key={d.email}
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setEmail(d.email)
              setPassword('dsadsadsa')
            }}
          >
            {d.label}
          </button>
        ))}
      </div>
      <p className="login-hint">
        New employee? <Link to="/register">Register here</Link>
        {' · '}Dev password: dsadsadsa
      </p>
    </div>
  )
}
