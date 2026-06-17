import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { PageHeader } from '../../components/PageHeader'

const TOOLS = [
  {
    to: '/admin/settings',
    title: 'Settings',
    description: 'Branches, departments, positions, geofence, and org structure.',
  },
  {
    to: '/admin/compliance',
    title: 'Compliance',
    description: 'Food safety, labor, and audit checklists.',
  },
  {
    to: '/admin/users',
    title: 'Staff logins',
    description: 'HR and crew accounts, roles, and permissions. System admin is not listed here.',
  },
] as const

export function AdminDashboardPage() {
  const { user } = useAuth()
  const name = user?.email?.split('@')[0] ?? 'Admin'

  return (
    <div>
      <PageHeader
        title="System overview"
        subtitle={`Welcome, ${name}. Configure the restaurant platform — settings, compliance, and staff access.`}
      />

      <div className="card admin-account-note" style={{ marginBottom: '1.5rem' }}>
        <strong>Signed in as system admin</strong>
        <p className="muted-block" style={{ marginTop: '0.35rem', marginBottom: 0 }}>
          Your login (<code>{user?.email}</code>) is the platform owner account. It is managed outside
          Staff logins and cannot be edited or deactivated from that screen.
        </p>
      </div>

      <h2 className="section-title">System tools</h2>
      <div className="stat-grid admin-tools-grid">
        {TOOLS.map((tool) => (
          <Link key={tool.to} to={tool.to} className="card stat-card admin-tool-card">
            <div className="admin-tool-title">{tool.title}</div>
            <p className="admin-tool-desc">{tool.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
