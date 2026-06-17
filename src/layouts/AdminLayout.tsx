import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SidebarNav } from '../components/SidebarNav'
import { SidebarUserMenu } from '../components/SidebarUserMenu'
import { staffMenuSections } from '../config/navigation'
import { isSystemAdmin } from '../lib/roles'
import { NotificationBell } from '../components/NotificationBell'

export function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const sections = staffMenuSections(user)
  const portalLabel = isSystemAdmin(user) ? 'System Admin' : 'HR Portal'

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="dash admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">HG</span>
          <div>
            <strong>Highway Grill</strong>
            <small>{portalLabel}</small>
          </div>
        </div>
        <nav>
          {sections.map((section) => (
            <div key={section.label ?? 'main'} className="sidebar-section">
              {section.label && <div className="sidebar-section-label">{section.label}</div>}
              <SidebarNav entries={section.items} user={user} />
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <SidebarUserMenu
            primary={user?.email ?? 'Account'}
            secondary={user?.role_name}
            onLogout={handleLogout}
          />
        </div>
      </aside>
      <main className="main">
        <div className="main-top-bar">
          <NotificationBell />
        </div>
        <Outlet />
      </main>
    </div>
  )
}
