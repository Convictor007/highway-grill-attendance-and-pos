import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Spinner } from '../../components/Spinner'
import { BrandLogo } from '../../components/BrandLogo'
import { useAuth } from '../../context/AuthContext'
import { useNotification } from '../../hooks/useNotification'
import { ApiError } from '../../lib/api'
import { RoleSlug } from '../../types/roles'

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const { error: notifyError } = useNotification()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      <div className="login-head">
        <div className="login-head-text">
          <span className="login-badge">HRMS Portal</span>
          <h1>Welcome back</h1>
          <p className="login-sub">Sign in to manage your team at Highway Grill</p>
        </div>
        <span className="login-logo-badge">
          <BrandLogo size="md" />
        </span>
      </div>

      <form onSubmit={onSubmit} className="login-form">
        <div className="form-group login-field">
          <label htmlFor="email">Email</label>
          <div className="login-input-wrap">
            <svg className="login-input-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path
                d="M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path d="M4 7l8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder="you@highwaygrill.com"
            />
          </div>
        </div>

        <div className="form-group login-field">
          <label htmlFor="password">Password</label>
          <div className="login-input-wrap">
            <svg className="login-input-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <rect x="4" y="10" width="16" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 10V7a4 4 0 018 0v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
            <button
              type="button"
              className="login-eye"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                  <path
                    d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.4 5.2A9.4 9.4 0 0112 5c5 0 9 4 10 7a13 13 0 01-2.4 3.3M6.1 6.1A13 13 0 002 12c1 3 5 7 10 7a9.3 9.3 0 003.9-.8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                  <path d="M2 12c1-3 5-7 10-7s9 4 10 7c-1 3-5 7-10 7s-9-4-10-7z" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <button type="submit" className="btn btn-primary login-submit" disabled={submitting}>
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

      <p className="login-hint">
        New employee? <Link to="/register">Register here</Link>
      </p>
    </div>
  )
}
