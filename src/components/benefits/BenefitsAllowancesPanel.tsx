import { EmptyState } from '../EmptyState'
import type { BenefitEnrollment } from '../../types/hrms'
import { formatBenefitMoney, frequencyLabel } from '../../lib/benefitsUi'

type Props = {
  enrollments: BenefitEnrollment[]
  canManage?: boolean
  onAdd?: () => void
  onEdit?: (enrollment: BenefitEnrollment) => void
  onDelete?: (enrollment: BenefitEnrollment) => void
}

export function BenefitsAllowancesPanel({ enrollments, canManage, onAdd, onEdit, onDelete }: Props) {
  return (
    <div className="stack">
      <div className="card">
        <div className="benefits-panel-head">
          <div>
            <h3 className="section-title">Enrolled allowances</h3>
            <p className="form-hint" style={{ marginTop: 0 }}>
              Meal, transport, rice, and other recurring amounts added to gross pay. Government contributions are under
              the SSS, PhilHealth, and Pag-IBIG tabs.
            </p>
          </div>
          {canManage && onAdd && (
            <button type="button" className="btn btn-primary btn-sm" onClick={onAdd}>
              Add allowance
            </button>
          )}
        </div>

        {enrollments.length === 0 ? (
          <EmptyState
            title="No allowances"
            description="Add meal, transport, or other recurring benefits for this employee."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Benefit</th>
                  <th>Code</th>
                  <th>Amount</th>
                  <th>Frequency</th>
                  <th>Status</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {enrollments.map((b) => {
                  const active = b.is_active !== false && b.is_active !== 0
                  return (
                    <tr key={b.id} className={!active ? 'table-row--muted' : undefined}>
                      <td>{b.benefit_name}</td>
                      <td>{b.benefit_code}</td>
                      <td>{formatBenefitMoney(b.amount)}</td>
                      <td>{frequencyLabel(b.frequency)}</td>
                      <td>
                        <span className={`badge badge-${active ? 'approved' : 'pending'}`}>
                          {active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {canManage && (
                        <td>
                          <button type="button" className="text-link" onClick={() => onEdit?.(b)}>
                            Edit
                          </button>
                          {' · '}
                          <button
                            type="button"
                            className="text-link text-link--danger"
                            onClick={() => onDelete?.(b)}
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
