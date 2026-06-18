import type { BenefitsRemittanceSummary } from '../../types/hrms'
import { formatBenefitMoney } from '../../lib/benefitsUi'

type Props = {
  summary: BenefitsRemittanceSummary | null
  loading?: boolean
  year: number
  month: number
  branchFilter: string
  branches: { id: string; name: string }[]
  onYearChange: (year: number) => void
  onMonthChange: (month: number) => void
  onBranchChange: (branchId: string) => void
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function BenefitsRemittancePanel({
  summary,
  loading,
  year,
  month,
  branchFilter,
  branches,
  onYearChange,
  onMonthChange,
  onBranchChange,
}: Props) {
  const years = [year - 1, year, year + 1]

  return (
    <div className="stack">
      <div className="card">
        <div className="benefits-panel-head">
          <div>
            <h3 className="section-title">Monthly remittance summary</h3>
            <p className="form-hint" style={{ marginTop: 0 }}>
              Totals from processed payslips for SSS, PhilHealth, and Pag-IBIG filing. Employer shares are estimated.
            </p>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Year</label>
            <select value={year} onChange={(e) => onYearChange(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Month</label>
            <select value={month} onChange={(e) => onMonthChange(Number(e.target.value))}>
              {MONTHS.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Branch</label>
            <select value={branchFilter} onChange={(e) => onBranchChange(e.target.value)}>
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="muted-block">Loading remittance summary…</p>
      ) : summary ? (
        <>
          <div className="benefits-stat-grid">
            <div className="card benefits-stat-card">
              <span className="benefits-stat-label">Employees</span>
              <strong>{summary.employee_count}</strong>
            </div>
            <div className="card benefits-stat-card">
              <span className="benefits-stat-label">Payslips</span>
              <strong>{summary.payslip_count}</strong>
            </div>
            <div className="card benefits-stat-card">
              <span className="benefits-stat-label">Tax withheld</span>
              <strong>{formatBenefitMoney(summary.tax_withheld)}</strong>
            </div>
            <div className="card benefits-stat-card">
              <span className="benefits-stat-label">Total gross</span>
              <strong>{formatBenefitMoney(summary.total_gross)}</strong>
            </div>
          </div>

          <div className="card table-wrap">
            <h3 className="section-title">
              {MONTHS[month - 1]} {year} — agency totals
            </h3>
            <table>
              <thead>
                <tr>
                  <th>Agency</th>
                  <th>Employee share</th>
                  <th>Employer share (est.)</th>
                  <th>Total (est.)</th>
                </tr>
              </thead>
              <tbody>
                {summary.agencies.map((agency) => (
                  <tr key={agency.agency}>
                    <td>{agency.label}</td>
                    <td>{formatBenefitMoney(agency.employee_share)}</td>
                    <td>{formatBenefitMoney(agency.employer_share_est)}</td>
                    <td>
                      <strong>{formatBenefitMoney(agency.total_est)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="form-hint" style={{ marginTop: '1rem' }}>
              {summary.note}
            </p>
          </div>
        </>
      ) : (
        <p className="muted-block">No remittance data for this period.</p>
      )}
    </div>
  )
}
