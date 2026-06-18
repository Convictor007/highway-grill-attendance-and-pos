import type { BenefitsOverview } from '../../types/hrms'
import { formatBenefitMoney } from '../../lib/benefitsUi'

type Props = {
  data: BenefitsOverview
}

export function BenefitsOverviewPanel({ data }: Props) {
  const latest = data.latest_payslip

  return (
    <div className="stack">
      <div className="benefits-stat-grid benefits-stat-grid--4">
        {data.agencies.map((agency) => (
          <div key={agency.agency} className="card benefits-stat-card">
            <span className="benefits-stat-label">{agency.label}</span>
            <span className="benefits-stat-value">{formatBenefitMoney(agency.per_payroll_share)}</span>
            <span className="benefits-stat-sub">per payroll · YTD {formatBenefitMoney(agency.ytd)}</span>
          </div>
        ))}
        <div className="card benefits-stat-card">
          <span className="benefits-stat-label">Withholding tax</span>
          <span className="benefits-stat-value">{formatBenefitMoney(data.withholding_tax.per_payroll)}</span>
          <span className="benefits-stat-sub">per payroll · YTD {formatBenefitMoney(data.withholding_tax.ytd)}</span>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Compensation basis</h3>
        <dl className="benefits-dl">
          <div>
            <dt>Estimated monthly pay</dt>
            <dd>{formatBenefitMoney(data.monthly_compensation)}</dd>
          </div>
          <div>
            <dt>Pay basis</dt>
            <dd>{data.employee?.pay_basis === 'daily' ? 'Daily' : 'Hourly'}</dd>
          </div>
          <div>
            <dt>Rate</dt>
            <dd>{formatBenefitMoney(data.employee?.pay_rate)}</dd>
          </div>
        </dl>
        <p className="form-hint">
          Government shares are estimated from pay rate and deducted automatically during payroll runs.
        </p>
      </div>

      {latest && (
        <div className="card">
          <h3 className="section-title">Latest payslip deductions</h3>
          <p className="muted-block" style={{ marginBottom: '1rem' }}>
            Pay date <strong>{latest.pay_date}</strong> ({latest.period_start} – {latest.period_end})
          </p>
          <dl className="benefits-dl">
            <div>
              <dt>SSS</dt>
              <dd>{formatBenefitMoney(latest.sss_amount)}</dd>
            </div>
            <div>
              <dt>PhilHealth</dt>
              <dd>{formatBenefitMoney(latest.philhealth_amount)}</dd>
            </div>
            <div>
              <dt>Pag-IBIG</dt>
              <dd>{formatBenefitMoney(latest.pagibig_amount)}</dd>
            </div>
            <div>
              <dt>Withholding tax</dt>
              <dd>{formatBenefitMoney(latest.tax_amount)}</dd>
            </div>
            <div className="benefits-dl-total">
              <dt>Net pay</dt>
              <dd>
                <strong>{formatBenefitMoney(latest.net_pay)}</strong>
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  )
}
