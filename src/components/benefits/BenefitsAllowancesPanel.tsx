import { EmptyState } from '../EmptyState'
import type { BenefitEnrollment } from '../../types/hrms'
import { formatBenefitMoney, frequencyLabel } from '../../lib/benefitsUi'

type Props = {
  enrollments: BenefitEnrollment[]
  canManage?: boolean
  children?: React.ReactNode
}

export function BenefitsAllowancesPanel({ enrollments, canManage, children }: Props) {
  return (
    <div className="stack">
      {canManage && children}
      <div className="card">
        <h3 className="section-title">Enrolled allowances</h3>
        <p className="form-hint" style={{ marginTop: 0 }}>
          Meal, transport, and other recurring allowances added to gross pay. Government contributions are managed
          under SSS, PhilHealth, and Pag-IBIG tabs.
        </p>
        {enrollments.length === 0 ? (
          <EmptyState title="No allowances" description="HR can enroll meal, transport, or other benefits." />
        ) : (
          <ul className="doc-list">
            {enrollments.map((b) => (
              <li key={b.id} className="doc-row">
                <div>
                  <strong>{b.benefit_name}</strong>
                  <span className="doc-meta">
                    {b.benefit_code} · {frequencyLabel(b.frequency)}
                  </span>
                </div>
                <span>{formatBenefitMoney(b.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
