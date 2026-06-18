import { useEffect, useState, type FormEvent } from 'react'
import type { BenefitsDeductionSetup, DeductionMode } from '../../types/hrms'
import { formatBenefitMoney } from '../../lib/benefitsUi'

type Props = {
  employeeId: string
  setup: BenefitsDeductionSetup | null
  saving?: boolean
  onSave: (payload: Record<string, unknown>) => Promise<void>
}

type AgencyKey = 'sss' | 'philhealth' | 'pagibig' | 'tax'

const AGENCIES: {
  key: AgencyKey
  label: string
  idLabel: string
  idPlaceholder: string
  idField: 'sss_number' | 'philhealth_number' | 'pagibig_number' | 'tin'
  enrolledField: 'sss_enrolled' | 'philhealth_enrolled' | 'pagibig_enrolled' | 'tax_enrolled'
  modeField: 'sss_deduction_mode' | 'philhealth_deduction_mode' | 'pagibig_deduction_mode' | 'tax_deduction_mode'
  amountField:
    | 'sss_monthly_amount'
    | 'philhealth_monthly_amount'
    | 'pagibig_monthly_amount'
    | 'tax_monthly_amount'
}[] = [
  {
    key: 'sss',
    label: 'SSS',
    idLabel: 'SSS number',
    idPlaceholder: '34-1234567-8',
    idField: 'sss_number',
    enrolledField: 'sss_enrolled',
    modeField: 'sss_deduction_mode',
    amountField: 'sss_monthly_amount',
  },
  {
    key: 'philhealth',
    label: 'PhilHealth',
    idLabel: 'PhilHealth number',
    idPlaceholder: '12-345678901-2',
    idField: 'philhealth_number',
    enrolledField: 'philhealth_enrolled',
    modeField: 'philhealth_deduction_mode',
    amountField: 'philhealth_monthly_amount',
  },
  {
    key: 'pagibig',
    label: 'Pag-IBIG',
    idLabel: 'Pag-IBIG number',
    idPlaceholder: '1212-3456-7890',
    idField: 'pagibig_number',
    enrolledField: 'pagibig_enrolled',
    modeField: 'pagibig_deduction_mode',
    amountField: 'pagibig_monthly_amount',
  },
  {
    key: 'tax',
    label: 'Withholding tax',
    idLabel: 'TIN',
    idPlaceholder: '123-456-789-000',
    idField: 'tin',
    enrolledField: 'tax_enrolled',
    modeField: 'tax_deduction_mode',
    amountField: 'tax_monthly_amount',
  },
]

const emptyForm = () => ({
  sss_number: '',
  philhealth_number: '',
  pagibig_number: '',
  tin: '',
  sss_enrolled: true,
  philhealth_enrolled: true,
  pagibig_enrolled: true,
  tax_enrolled: true,
  sss_deduction_mode: 'auto' as DeductionMode,
  philhealth_deduction_mode: 'auto' as DeductionMode,
  pagibig_deduction_mode: 'auto' as DeductionMode,
  tax_deduction_mode: 'auto' as DeductionMode,
  sss_monthly_amount: '',
  philhealth_monthly_amount: '',
  pagibig_monthly_amount: '',
  tax_monthly_amount: '',
  notes: '',
})

export function StatutoryDeductionsForm({ employeeId, setup, saving, onSave }: Props) {
  const [form, setForm] = useState(emptyForm())
  const profile = setup?.profile
  const auto = setup?.auto_monthly
  const semi = setup?.per_payroll.semi_monthly
  const monthly = setup?.per_payroll.monthly

  useEffect(() => {
    if (!profile) {
      setForm(emptyForm())
      return
    }
    setForm({
      sss_number: profile.sss_number ?? '',
      philhealth_number: profile.philhealth_number ?? '',
      pagibig_number: profile.pagibig_number ?? '',
      tin: profile.tin ?? '',
      sss_enrolled: profile.sss_enrolled !== false,
      philhealth_enrolled: profile.philhealth_enrolled !== false,
      pagibig_enrolled: profile.pagibig_enrolled !== false,
      tax_enrolled: profile.tax_enrolled !== false,
      sss_deduction_mode: profile.sss_deduction_mode === 'manual' ? 'manual' : 'auto',
      philhealth_deduction_mode: profile.philhealth_deduction_mode === 'manual' ? 'manual' : 'auto',
      pagibig_deduction_mode: profile.pagibig_deduction_mode === 'manual' ? 'manual' : 'auto',
      tax_deduction_mode: profile.tax_deduction_mode === 'manual' ? 'manual' : 'auto',
      sss_monthly_amount: profile.sss_monthly_amount != null ? String(profile.sss_monthly_amount) : '',
      philhealth_monthly_amount:
        profile.philhealth_monthly_amount != null ? String(profile.philhealth_monthly_amount) : '',
      pagibig_monthly_amount: profile.pagibig_monthly_amount != null ? String(profile.pagibig_monthly_amount) : '',
      tax_monthly_amount: profile.tax_monthly_amount != null ? String(profile.tax_monthly_amount) : '',
      notes: profile.notes ?? '',
    })
  }, [employeeId, profile])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const payload: Record<string, unknown> = {
      employee_id: employeeId,
      sss_number: form.sss_number,
      philhealth_number: form.philhealth_number,
      pagibig_number: form.pagibig_number,
      tin: form.tin,
      sss_enrolled: form.sss_enrolled,
      philhealth_enrolled: form.philhealth_enrolled,
      pagibig_enrolled: form.pagibig_enrolled,
      tax_enrolled: form.tax_enrolled,
      sss_deduction_mode: form.sss_deduction_mode,
      philhealth_deduction_mode: form.philhealth_deduction_mode,
      pagibig_deduction_mode: form.pagibig_deduction_mode,
      tax_deduction_mode: form.tax_deduction_mode,
      notes: form.notes,
    }
    for (const agency of AGENCIES) {
      if (form[agency.modeField] === 'manual') {
        const raw = form[agency.amountField]
        payload[agency.amountField] = raw === '' ? 0 : Number(raw)
      } else {
        payload[agency.amountField] = null
      }
    }
    await onSave(payload)
  }

  const preview = (key: AgencyKey, mode: DeductionMode, enrolled: boolean, amountStr: string) => {
    if (!enrolled) return { semi: 0, monthly: 0 }
    if (mode === 'manual') {
      const m = amountStr === '' ? 0 : Number(amountStr)
      return { semi: m / 2, monthly: m }
    }
    return {
      semi: semi?.[key] ?? 0,
      monthly: monthly?.[key] ?? 0,
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="card">
        <h3 className="section-title">Statutory deductions</h3>
        <p className="form-hint" style={{ marginTop: 0 }}>
          Set member IDs and how much to deduct each payroll. Amounts apply automatically when HR runs payroll —
          semi-monthly runs use half of the monthly amount; monthly runs use the full monthly amount.
        </p>
        {setup?.employee && (
          <p className="muted-block" style={{ marginBottom: '1rem' }}>
            Estimated pay: {formatBenefitMoney(setup.employee.monthly_compensation)}/month (
            {setup.employee.pay_basis === 'daily' ? 'daily' : 'hourly'} @{' '}
            {formatBenefitMoney(setup.employee.pay_rate)})
          </p>
        )}

        <div className="table-wrap">
          <table className="benefits-deduction-table">
            <thead>
              <tr>
                <th>Benefit</th>
                <th>Member ID</th>
                <th>Deduct</th>
                <th>Amount</th>
                <th>Per semi-monthly run</th>
                <th>Per monthly run</th>
              </tr>
            </thead>
            <tbody>
              {AGENCIES.map((agency) => {
                const enrolled = Boolean(form[agency.enrolledField])
                const mode = form[agency.modeField]
                const amountStr = form[agency.amountField]
                const p = preview(agency.key, mode, enrolled, amountStr)
                const autoAmt = auto?.[agency.key] ?? 0
                return (
                  <tr key={agency.key}>
                    <td>
                      <strong>{agency.label}</strong>
                    </td>
                    <td>
                      <input
                        value={form[agency.idField]}
                        onChange={(e) => setForm({ ...form, [agency.idField]: e.target.value })}
                        placeholder={agency.idPlaceholder}
                        aria-label={agency.idLabel}
                      />
                    </td>
                    <td>
                      <label className="geofence-field geofence-field--checkbox">
                        <input
                          type="checkbox"
                          checked={enrolled}
                          onChange={(e) => setForm({ ...form, [agency.enrolledField]: e.target.checked })}
                        />
                        <span>Yes</span>
                      </label>
                    </td>
                    <td>
                      <div className="stack" style={{ gap: '0.35rem' }}>
                        <select
                          value={mode}
                          disabled={!enrolled}
                          onChange={(e) =>
                            setForm({ ...form, [agency.modeField]: e.target.value as DeductionMode })
                          }
                        >
                          <option value="auto">Automatic ({formatBenefitMoney(autoAmt)}/mo)</option>
                          <option value="manual">Fixed monthly</option>
                        </select>
                        {mode === 'manual' && enrolled && (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={amountStr}
                            onChange={(e) => setForm({ ...form, [agency.amountField]: e.target.value })}
                            placeholder="Monthly amount"
                            required
                          />
                        )}
                      </div>
                    </td>
                    <td>{formatBenefitMoney(p.semi)}</td>
                    <td>{formatBenefitMoney(p.monthly)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label>Notes (optional)</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        </div>

        <div className="quick-actions" style={{ margin: '1rem 0 0' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save deductions'}
          </button>
        </div>
      </div>
    </form>
  )
}
