import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { api } from '../../lib/api'

type Overview = {
  logins_24h: number
  failed_logins_24h: number
  registrations_7d: number
  active_threats: number
  online_sessions: number
  tracked_devices?: number
}

const TOOLS = [
  {
    to: '/security/auth-logs',
    title: 'Auth logs',
    description: 'Login, logout, and failed sign-in attempts with IP address.',
  },
  {
    to: '/security/registration-logs',
    title: 'Registration logs',
    description: 'Crew sign-ups, HR approvals, rejections, and activations.',
  },
  {
    to: '/security/threats',
    title: 'Threats',
    description: 'Suspicious IPs and brute-force / rate-limit activity.',
  },
  {
    to: '/security/map',
    title: 'Employee map',
    description: 'Live device positions from background location sync.',
  },
] as const

export function SecurityDashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null)

  useEffect(() => {
    api<Overview>('/security/overview')
      .then(setOverview)
      .catch(() => setOverview(null))
  }, [])

  return (
    <div>
      <PageHeader
        title="Security overview"
        subtitle="Super Admin portal — authentication, registrations, threats, and live employee locations."
      />

      {overview ? (
        <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="card stat-card">
            <div className="stat-value">{overview.logins_24h}</div>
            <div className="stat-label">Logins (24h)</div>
          </div>
          <div className="card stat-card">
            <div className="stat-value">{overview.failed_logins_24h}</div>
            <div className="stat-label">Failed (24h)</div>
          </div>
          <div className="card stat-card">
            <div className="stat-value">{overview.active_threats}</div>
            <div className="stat-label">Active threats</div>
          </div>
          <div className="card stat-card">
            <div className="stat-value">{overview.tracked_devices ?? 0}</div>
            <div className="stat-label">Tracked (30m)</div>
          </div>
          <div className="card stat-card">
            <div className="stat-value">{overview.registrations_7d}</div>
            <div className="stat-label">Registrations (7d)</div>
          </div>
          <div className="card stat-card">
            <div className="stat-value">{overview.online_sessions}</div>
            <div className="stat-label">Online sessions</div>
          </div>
        </div>
      ) : (
        <div className="card muted-block" style={{ marginBottom: '1.5rem' }}>
          Security overview unavailable. Ensure API routes are deployed and your account has security.view.
        </div>
      )}

      <h2 className="section-title">Security tools</h2>
      <div className="stat-grid admin-tools-grid">
        {TOOLS.map((tool) => (
          <Link key={tool.to} to={tool.to} className="card stat-card admin-tool-card">
            <div className="admin-tool-title">{tool.title}</div>
            <p className="admin-tool-desc">{tool.description}</p>
          </Link>
        ))}
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <strong>Separate from System Admin</strong>
        <p className="muted-block" style={{ marginTop: '0.35rem', marginBottom: 0 }}>
          System Admin configures the platform (settings, compliance, staff logins). Super Admin monitors
          security events and device locations only.
        </p>
      </div>
    </div>
  )
}
