import { EmptyState } from '../EmptyState'
import type { BenefitContributionRow, BenefitsAgencySummary, GovernmentAgency } from '../../types/hrms'
import { formatBenefitMoney, GOVERNMENT_AGENCY_HINTS } from '../../lib/benefitsUi'

type Props = {
  agency: BenefitsAgencySummary
  history: BenefitContributionRow[]
  canEdit?: boolean
  onEdit?: () => void
}

export function BenefitsAgencyPanel({ agency, history, canEdit, onEdit }: Props) {
  const hint = GOVERNMENT_AGENCY_HINTS[agency.agency as GovernmentAgency]

  return (
    <div className="stack">
      <div className="benefits-stat-grid benefits-stat-grid--5">
        <div className="card benefits-stat-card">
          <span className="benefits-stat-label">Member ID</span>
          <span className="benefits-stat-value">{agency.member_id || 'Not on file'}</span>
        </div>
        <div className="card benefits-stat-card">
          <span className="benefits-stat-label">Status</span>
          <span className={`benefits-stat-value${agency.enrolled ? ' text-success' : ' text-muted'}`}>
            {agency.enrolled ? 'Enrolled' : 'Not enrolled'}
          </span>
        </div>
        <div className="card benefits-stat-card">
          <span className="benefits-stat-label">Per payroll (est.)</span>
          <span className="benefits-stat-value">{formatBenefitMoney(agency.per_payroll_share)}</span>
        </div>
        <div className="card benefits-stat-card">
          <span className="benefits-stat-label">Monthly (est.)</span>
          <span className="benefits-stat-value">{formatBenefitMoney(agency.monthly_employee_share)}</span>
        </div>
        <div className="card benefits-stat-card">
          <span className="benefits-stat-label">YTD deducted</span>
          <span className="benefits-stat-value">{formatBenefitMoney(agency.ytd)}</span>
        </div>
      </div>

      <div className="card">
        <div className="benefits-panel-head">
          <div>
            <h3 className="section-title">{agency.label}</h3>
            <p className="form-hint" style={{ marginTop: 0 }}>
              {hint}
            </p>
          </div>
          {canEdit && onEdit && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>
              Edit profile
            </button>
          )}
        </div>
      </div>

      <div className="card table-wrap">
        <h3 className="section-title">Contribution history</h3>
        {history.length === 0 ? (
          <EmptyState
            title="No deductions yet"
            description="Amounts appear here after HR processes payroll with government deductions."
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Pay date</th>
                <th>Period</th>
                <th>Gross</th>
                <th>Deduction</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.payslip_id}>
                  <td>{row.pay_date}</td>
                  <td>
                    {row.period_start} – {row.period_end}
                  </td>
                  <td>{formatBenefitMoney(row.gross_pay)}</td>
                  <td>{formatBenefitMoney(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
