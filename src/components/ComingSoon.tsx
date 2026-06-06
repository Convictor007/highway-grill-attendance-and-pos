import { Link } from 'react-router-dom'
import { PageHeader } from './PageHeader'

type Props = {
  title: string
  subtitle?: string
  message?: string
}

export function ComingSoon({ title, subtitle, message }: Props) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="card coming-soon-card">
        <p className="coming-soon-icon" aria-hidden>🚧</p>
        <p className="coming-soon-title">Coming soon</p>
        <p className="coming-soon-desc">
          {message ?? 'This module will be available in a future update. Contact HR for urgent requests.'}
        </p>
        <Link to="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Back to Home
        </Link>
      </div>
    </div>
  )
}
