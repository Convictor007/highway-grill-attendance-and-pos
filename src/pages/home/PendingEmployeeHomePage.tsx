import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export function PendingEmployeeHomePage() {
  const { user } = useAuth()
  const name = user?.employee?.first_name ?? 'there'

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h2 style={{ marginTop: 0 }}>Welcome, {name}</h2>
      <p>
        HR has approved your registration. Your account status is <strong>pending</strong> until HR activates you for
        on-duty features.
      </p>
      <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.6 }}>
        <li>You can sign in and check notifications here.</li>
        <li>Time in/out, schedules, loans, and payroll unlock when HR sets your account to <strong>active</strong>.</li>
        <li>You will receive an email and in-app notification when activation is complete.</li>
      </ul>
      <div className="quick-actions" style={{ marginTop: '1.25rem' }}>
        <Link to="/profile" className="btn btn-primary">View profile</Link>
      </div>
    </div>
  )
}
