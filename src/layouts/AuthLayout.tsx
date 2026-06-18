import { Outlet } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo'

export function AuthLayout() {
  return (
    <div className="auth-layout">
      <div className="auth-layout-inner">
        <BrandLogo size="lg" className="auth-layout-logo" />
        <Outlet />
      </div>
    </div>
  )
}
