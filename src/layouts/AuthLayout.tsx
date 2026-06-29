import { Outlet, useLocation } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo'
import hgLogo from '../assets/HG_logo.png'

export function AuthLayout() {
  const location = useLocation()
  // The login card carries its own logo; avoid showing it twice.
  const hideStandaloneLogo = location.pathname === '/login'

  return (
    <div className="auth-layout">
      <img src={hgLogo} alt="" aria-hidden className="auth-bg-logo" />
      <div className="auth-layout-inner">
        {!hideStandaloneLogo && <BrandLogo size="lg" className="auth-layout-logo" />}
        <Outlet />
      </div>
    </div>
  )
}
