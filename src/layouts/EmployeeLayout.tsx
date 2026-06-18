import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { NavIcon } from '../components/NavIcon'
import { BrandLogo } from '../components/BrandLogo'
import { SidebarUserMenu } from '../components/SidebarUserMenu'
import { employeeMenuItems, filterNav } from '../config/navigation'
import { NotificationBell } from '../components/NotificationBell'

const mobileTabs = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/menu', label: 'Menu', icon: 'menu' },
  { to: '/profile', label: 'Profile', icon: 'user' },
]

export function EmployeeLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuItems = filterNav(employeeMenuItems, user)
  const today = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const closeDrawer = () => setDrawerOpen(false)

  return (
    <div className="employee-shell">
      <header className="app-header">
        <div className="app-header-brand">
          <BrandLogo size="sm" />
          <div>
            <strong>Highway Grill</strong>
            <span className="app-header-date">{today}</span>
          </div>
        </div>
        <div className="app-header-actions">
          <NotificationBell />
          <button
            type="button"
            className="btn-icon desktop-hidden"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
          >
            <NavIcon name="menu" />
          </button>
        </div>
      </header>

      <aside className={`employee-sidebar ${drawerOpen ? 'open' : ''}`}>
        <div className="sidebar-panel-head desktop-hidden">
          <strong>Menu</strong>
          <button type="button" className="btn-icon" aria-label="Close" onClick={closeDrawer}>
            ×
          </button>
        </div>
        <nav className="employee-sidebar-nav" onClick={closeDrawer}>
          <NavLink to="/" end className="sidebar-link">
            <NavIcon name="home" />
            <span>Home</span>
          </NavLink>
          {menuItems
            .filter((m) => m.to !== '/profile')
            .map((item) => (
              <NavLink key={item.to} to={item.to} className="sidebar-link">
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          <NavLink to="/profile" className="sidebar-link sidebar-link-profile">
            <NavIcon name="user" />
            <span>Profile</span>
          </NavLink>
        </nav>
        <div className="sidebar-panel-foot">
          <SidebarUserMenu
            primary={user?.employee?.first_name ?? user?.email ?? 'Account'}
            secondary={user?.role_name}
            onLogout={handleLogout}
          />
        </div>
      </aside>

      {drawerOpen && <button type="button" className="sidebar-backdrop desktop-hidden" aria-label="Close" onClick={closeDrawer} />}

      <main className="employee-main">
        <Outlet />
      </main>

      <nav className="bottom-nav desktop-hidden" aria-label="Main">
        {mobileTabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => (isActive ? 'bottom-nav-item active' : 'bottom-nav-item')}
          >
            <NavIcon name={tab.icon} />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>

      {location.pathname === '/menu' && <div className="desktop-hidden" />}
    </div>
  )
}
