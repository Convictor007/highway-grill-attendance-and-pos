import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { NavIcon } from '../components/NavIcon'
import { adminMenuItems, filterNav } from '../config/navigation'
import { NotificationBell } from '../components/NotificationBell'

export function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const items = filterNav(adminMenuItems, user)

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
            <small>HR Admin</small>
          </div>
        </div>
        <nav>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav active' : 'nav')}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-meta">
            <span className="user-email">{user?.email}</span>
            <span className="user-role">{user?.role_name}</span>
          </div>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Sign out
          </button>
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
