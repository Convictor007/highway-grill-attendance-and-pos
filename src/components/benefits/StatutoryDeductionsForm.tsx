import { useEffect, useState, type FormEvent } from 'react'
import type { BenefitsDeductionSetup } from '../../types/hrms'
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
  idPlaceholder: string
  idField: 'sss_number' | 'philhealth_number' | 'pagibig_number' | 'tin'
  amountField:
    | 'sss_monthly_amount'
    | 'philhealth_monthly_amount'
    | 'pagibig_monthly_amount'
    | 'tax_monthly_amount'
  enrolledField: 'sss_enrolled' | 'philhealth_enrolled' | 'pagibig_enrolled' | 'tax_enrolled'
  modeField: 'sss_deduction_mode' | 'philhealth_deduction_mode' | 'pagibig_deduction_mode' | 'tax_deduction_mode'
}[] = [
  {
    key: 'sss',
    label: 'SSS',
    idPlaceholder: '34-1234567-8',
    idField: 'sss_number',
    amountField: 'sss_monthly_amount',
    enrolledField: 'sss_enrolled',
    modeField: 'sss_deduction_mode',
  },
  {
    key: 'philhealth',
    label: 'PhilHealth',
    idPlaceholder: '12-345678901-2',
    idField: 'philhealth_number',
    amountField: 'philhealth_monthly_amount',
    enrolledField: 'philhealth_enrolled',
    modeField: 'philhealth_deduction_mode',
  },
  {
    key: 'pagibig',
    label: 'Pag-IBIG',
    idPlaceholder: '1212-3456-7890',
    idField: 'pagibig_number',
    amountField: 'pagibig_monthly_amount',
    enrolledField: 'pagibig_enrolled',
    modeField: 'pagibig_deduction_mode',
  },
  {
    key: 'tax',
    label: 'Withholding tax',
    idPlaceholder: '123-456-789-000',
    idField: 'tin',
    amountField: 'tax_monthly_amount',
    enrolledField: 'tax_enrolled',
    modeField: 'tax_deduction_mode',
  },
]

const emptyForm = () => ({
  sss_number: '',
  philhealth_number: '',
  pagibig_number: '',
  tin: '',
  sss_monthly_amount: '',
  philhealth_monthly_amount: '',
  pagibig_monthly_amount: '',
  tax_monthly_amount: '',
  notes: '',
})

export function StatutoryDeductionsForm({ employeeId, setup, saving, onSave }: Props) {
  const [form, setForm] = useState(emptyForm())
  const profile = setup?.profile

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
      sss_monthly_amount: profile.sss_monthly_amount != null ? String(profile.sss_monthly_amount) : '',
      philhealth_monthly_amount:
        profile.philhealth_monthly_amount != null ? String(profile.philhealth_monthly_amount) : '',
      pagibig_monthly_amount: profile.pagibig_monthly_amount != null ? String(profile.pagibig_monthly_amount) : '',
      tax_monthly_amount: profile.tax_monthly_amount != null ? String(profile.tax_monthly_amount) : '',
      notes: profile.notes ?? '',
    })
  }, [employeeId, profile])

  const hasId = (field: (typeof AGENCIES)[number]['idField']) => Boolean(form[field].trim())

  const preview = (agency: (typeof AGENCIES)[number]) => {
    if (!hasId(agency.idField)) return { semi: 0, monthly: 0, active: false }
    const amountStr = form[agency.amountField]
    const m = amountStr === '' ? 0 : Number(amountStr)
    if (!m) return { semi: 0, monthly: 0, active: false }
    return { semi: m / 2, monthly: m, active: true }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const payload: Record<string, unknown> = {
      employee_id: employeeId,
      sss_number: form.sss_number.trim() || null,
      philhealth_number: form.philhealth_number.trim() || null,
      pagibig_number: form.pagibig_number.trim() || null,
      tin: form.tin.trim() || null,
      notes: form.notes,
    }

    for (const agency of AGENCIES) {
      const idPresent = hasId(agency.idField)
      const amountStr = form[agency.amountField]
      payload[agency.modeField] = 'manual'
      payload[agency.amountField] = idPresent ? (amountStr === '' ? null : Number(amountStr)) : null
      const p = preview(agency)
      payload[agency.enrolledField] = idPresent && p.active
    }

    await onSave(payload)
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="card">
        <h3 className="section-title">Statutory deductions</h3>
        <p className="form-hint" style={{ marginTop: 0 }}>
          Optional per benefit. Enter the member ID and the <strong>monthly amount you want deducted</strong> — that is
          the number you control here. No ID or no amount means nothing is deducted. Use the <strong>Bulk apply</strong>{' '}
          tab to set the same amount for many employees at once. Semi-monthly payroll takes half the monthly amount each
          run.
        </p>

        <div className="table-wrap">
          <table className="benefits-deduction-table">
            <thead>
              <tr>
                <th>Benefit</th>
                <th>Member ID</th>
                <th>Monthly deduction (₱)</th>
                <th>Per semi-monthly run</th>
                <th>Per monthly run</th>
              </tr>
            </thead>
            <tbody>
              {AGENCIES.map((agency) => {
                const idPresent = hasId(agency.idField)
                const p = preview(agency)
                return (
                  <tr key={agency.key}>
                    <td>
                      <strong>{agency.label}</strong>
                      {!idPresent && <div className="doc-meta">Skipped — no member ID</div>}
                    </td>
                    <td>
                      <input
                        value={form[agency.idField]}
                        onChange={(e) => setForm({ ...form, [agency.idField]: e.target.value })}
                        placeholder={agency.idPlaceholder}
                        aria-label={`${agency.label} member ID`}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form[agency.amountField]}
                        disabled={!idPresent}
                        onChange={(e) => setForm({ ...form, [agency.amountField]: e.target.value })}
                        placeholder={idPresent ? 'e.g. 270.00' : '—'}
                        aria-label={`${agency.label} monthly deduction`}
                      />
                    </td>
                    <td>{p.active ? formatBenefitMoney(p.semi) : '—'}</td>
                    <td>{p.active ? formatBenefitMoney(p.monthly) : '—'}</td>
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
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  )
}
