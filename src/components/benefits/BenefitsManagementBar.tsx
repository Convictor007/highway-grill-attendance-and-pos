import type { BenefitsOverview } from '../../types/hrms'

type Props = {
  data: BenefitsOverview
  onEditGovernment: () => void
  onAddAllowance: () => void
}

function idStatus(value: string | null | undefined, enrolled: boolean) {
  if (!enrolled) return { label: 'Not enrolled', ok: false }
  if (value?.trim()) return { label: 'On file', ok: true }
  return { label: 'Missing ID', ok: false }
}

export function BenefitsManagementBar({ data, onEditGovernment, onAddAllowance }: Props) {
  const profile = data.profile
  const items = [
    { name: 'SSS', ...idStatus(profile?.sss_number, profile?.sss_enrolled !== false) },
    { name: 'PhilHealth', ...idStatus(profile?.philhealth_number, profile?.philhealth_enrolled !== false) },
    { name: 'Pag-IBIG', ...idStatus(profile?.pagibig_number, profile?.pagibig_enrolled !== false) },
    { name: 'TIN', label: profile?.tin?.trim() ? 'On file' : 'Missing', ok: !!profile?.tin?.trim() },
  ]

  return (
    <div className="card benefits-management-bar">
      <div className="benefits-management-bar__head">
        <div>
          <h3 className="section-title">Manage benefits</h3>
          <p className="form-hint" style={{ marginTop: 0 }}>
            Set government member IDs, enrollment flags, and recurring allowances for this employee.
          </p>
        </div>
        <div className="quick-actions benefits-management-bar__actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={onEditGovernment}>
            Government IDs
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onAddAllowance}>
            Add allowance
          </button>
        </div>
      </div>
      <div className="benefits-management-bar__status">
        {items.map((item) => (
          <span key={item.name} className={`benefits-mgmt-chip${item.ok ? ' benefits-mgmt-chip--ok' : ''}`}>
            {item.name}: {item.label}
          </span>
        ))}
        <span className="benefits-mgmt-chip">
          Allowances: {data.enrollments.filter((e) => e.is_active !== false && e.is_active !== 0).length} active
        </span>
      </div>
    </div>
  )
}
