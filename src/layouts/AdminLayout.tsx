import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SidebarNav } from '../components/SidebarNav'
import { SidebarUserMenu } from '../components/SidebarUserMenu'
import { BrandLogo } from '../components/BrandLogo'
import { NavIcon } from '../components/NavIcon'
import { staffMenuSections } from '../config/navigation'
import { isSystemAdmin } from '../lib/roles'
import { NotificationBell } from '../components/NotificationBell'

export function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('hg_admin_sidebar_collapsed') === '1')
  const sections = staffMenuSections(user)
  const portalLabel = isSystemAdmin(user) ? 'System Admin' : 'HR Portal'

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const closeDrawer = () => setDrawerOpen(false)

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('hg_admin_sidebar_collapsed', next ? '1' : '0')
      return next
    })
  }

  const expandSidebar = () => {
    setCollapsed(false)
    localStorage.setItem('hg_admin_sidebar_collapsed', '0')
  }

  return (
    <div className={`dash admin-shell${collapsed ? ' admin-shell--collapsed' : ''}`}>
      <header className="app-header admin-app-header">
        <div className="app-header-brand">
          <BrandLogo size="sm" />
          <div>
            <strong>Highway Grill</strong>
            <span className="app-header-date">{portalLabel}</span>
          </div>
        </div>
        <div className="app-header-actions">
          <button
            type="button"
            className="btn-icon admin-menu-btn"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <NavIcon name="menu" />
          </button>
        </div>
      </header>

      <aside className={`sidebar admin-sidebar${drawerOpen ? ' open' : ''}`}>
        <div className="sidebar-panel-head admin-sidebar-panel-head">
          <strong>Menu</strong>
          <button type="button" className="btn-icon" aria-label="Close menu" onClick={closeDrawer}>
            ×
          </button>
        </div>
        <div className="brand admin-sidebar-brand">
          <BrandLogo size="md" />
          <div className="admin-sidebar-brand-text">
            <strong>Highway Grill</strong>
            <small>{portalLabel}</small>
          </div>
          <button
            type="button"
            className="sidebar-collapse-btn"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={toggleCollapsed}
          >
            <NavIcon name={collapsed ? 'chevron-right' : 'chevron-left'} />
          </button>
        </div>
        <nav>
          {sections.map((section) => (
            <div key={section.label ?? 'main'} className="sidebar-section">
              {section.label && <div className="sidebar-section-label">{section.label}</div>}
              <SidebarNav
                entries={section.items}
                user={user}
                onNavigate={closeDrawer}
                collapsed={collapsed}
                onExpand={expandSidebar}
              />
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

      {drawerOpen && (
        <button type="button" className="sidebar-backdrop admin-sidebar-backdrop" aria-label="Close menu" onClick={closeDrawer} />
      )}

      <main className="main admin-main">
        <div className="admin-toolbar">
          <NotificationBell />
        </div>
        <Outlet />
      </main>
    </div>
  )
}
