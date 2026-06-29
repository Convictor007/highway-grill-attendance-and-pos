import { Outlet, useLocation } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo'

export function AuthLayout() {
  const location = useLocation()
  // The login card carries its own logo; avoid showing it twice.
  const hideStandaloneLogo = location.pathname === '/login'

  return (
    <div className="auth-layout">
      <div className="auth-layout-inner">
        {!hideStandaloneLogo && <BrandLogo size="lg" className="auth-layout-logo" />}
        <Outlet />
      </div>
    </div>
  )
}
