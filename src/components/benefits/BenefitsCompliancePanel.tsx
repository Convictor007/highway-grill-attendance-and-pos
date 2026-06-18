import { EmptyState } from '../EmptyState'
import type { BenefitsComplianceReport } from '../../types/hrms'
import { COMPLIANCE_ISSUE_LABELS } from '../../lib/benefitsUi'

type Props = {
  report: BenefitsComplianceReport | null
  loading?: boolean
  branchFilter: string
  branches: { id: string; name: string }[]
  onBranchChange: (branchId: string) => void
  onFixEmployee?: (employeeId: string) => void
}

export function BenefitsCompliancePanel({
  report,
  loading,
  branchFilter,
  branches,
  onBranchChange,
  onFixEmployee,
}: Props) {
  return (
    <div className="stack">
      <div className="card">
        <div className="benefits-panel-head">
          <div>
            <h3 className="section-title">Statutory compliance</h3>
            <p className="form-hint" style={{ marginTop: 0 }}>
              Active employees missing government IDs, TIN, or with invalid number formats.
            </p>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: 180 }}>
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

        {loading ? (
          <p className="muted-block">Loading compliance report…</p>
        ) : report ? (
          <div className="benefits-compliance-stats">
            <span className="benefits-mgmt-chip benefits-mgmt-chip--ok">{report.compliant} compliant</span>
            <span className={`benefits-mgmt-chip${report.with_issues ? '' : ' benefits-mgmt-chip--ok'}`}>
              {report.with_issues} need attention
            </span>
            <span className="benefits-mgmt-chip">{report.total_active} active employees</span>
          </div>
        ) : null}
      </div>

      {!loading && report && report.employees.length === 0 ? (
        <EmptyState title="All clear" description="Every active employee has complete government benefit profiles." />
      ) : (
        report && (
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Branch</th>
                  <th>Issues</th>
                  {onFixEmployee && <th />}
                </tr>
              </thead>
              <tbody>
                {report.employees.map((row) => (
                  <tr key={row.employee_id}>
                    <td>
                      {row.first_name} {row.last_name}
                      <span className="doc-meta"> · {row.emp_number}</span>
                    </td>
                    <td>{row.branch_name}</td>
                    <td>
                      <ul className="benefits-issue-list">
                        {row.issues.map((issue) => (
                          <li key={issue}>{COMPLIANCE_ISSUE_LABELS[issue] ?? issue}</li>
                        ))}
                      </ul>
                    </td>
                    {onFixEmployee && (
                      <td>
                        <button type="button" className="text-link" onClick={() => onFixEmployee?.(row.employee_id)}>
                          Edit IDs
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
