import { useAuth } from '../../context/AuthContext'
import { PageHeader } from '../../components/PageHeader'

export function AdminDashboardPage() {
  const { user } = useAuth()
  const name = user?.employee?.first_name ?? user?.email?.split('@')[0] ?? 'Admin'

  return (
    <PageHeader
      title="System overview"
      subtitle={`Welcome, ${name}. Use the sidebar for settings, compliance, and system tools.`}
    />
  )
}
