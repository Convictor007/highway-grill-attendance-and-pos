import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { NavIcon } from '../../components/NavIcon'
import { employeeMenuItems, filterNav } from '../../config/navigation'

export function MenuPage() {
  const { user } = useAuth()
  const items = filterNav(employeeMenuItems, user)

  return (
    <div className="menu-page">
      <header className="menu-page-head">
        <h1>Menu</h1>
        <p>All HR self-service tools in one place</p>
      </header>
      <div className="menu-grid">
        {items.map((item) => (
          <Link key={item.to} to={item.to} className="menu-tile card">
            <span className="menu-tile-icon">
              <NavIcon name={item.icon} />
            </span>
            <span className="menu-tile-label">{item.label}</span>
            {item.description && <span className="menu-tile-desc">{item.description}</span>}
          </Link>
        ))}
      </div>
    </div>
  )
}
