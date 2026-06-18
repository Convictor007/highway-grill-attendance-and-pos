import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useNotification } from '../../hooks/useNotification'
import { formatBenefitMoney } from '../../lib/benefitsUi'

type Agency = 'sss' | 'philhealth' | 'pagibig' | 'tax'

type Props = {
  branches: { id: string; name: string }[]
}

const AGENCIES: { key: Agency; label: string }[] = [
  { key: 'sss', label: 'SSS' },
  { key: 'philhealth', label: 'PhilHealth' },
  { key: 'pagibig', label: 'Pag-IBIG' },
  { key: 'tax', label: 'Withholding tax' },
]

export function BenefitsBulkDeductionsPanel({ branches }: Props) {
  const { success, error: notifyError, confirm } = useNotification()
  const [branchId, setBranchId] = useState('')
  const [amounts, setAmounts] = useState<Record<Agency, string>>({
    sss: '',
    philhealth: '',
    pagibig: '',
    tax: '',
  })
  const [eligible, setEligible] = useState<Record<Agency, number>>({
    sss: 0,
    philhealth: 0,
    pagibig: 0,
    tax: 0,
  })
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState<Agency | null>(null)

  const loadEligible = async (branch: string) => {
    setLoading(true)
    try {
      const counts = await Promise.all(
        AGENCIES.map(async (a) => {
          const q = new URLSearchParams({ agency: a.key })
          if (branch) q.set('branch_id', branch)
          const row = await api<{ eligible: number }>(`/benefits/bulk-deductions?${q}`)
          return [a.key, row.eligible] as const
        }),
      )
      setEligible(Object.fromEntries(counts) as Record<Agency, number>)
    } catch {
      setEligible({ sss: 0, philhealth: 0, pagibig: 0, tax: 0 })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEligible(branchId)
  }, [branchId])

  const apply = async (agency: Agency, label: string) => {
    const raw = amounts[agency]
    if (raw === '' || Number(raw) < 0) {
      notifyError('Enter a monthly amount first')
      return
    }
    const count = eligible[agency]
    if (!count) {
      notifyError(`No employees have a ${label} member ID on file`)
      return
    }
    const ok = await confirm(
      `Set ${label} to ${formatBenefitMoney(raw)}/month for ${count} employee${count === 1 ? '' : 's'} with a member ID?`,
      { title: 'Apply bulk deduction', confirmLabel: 'Apply' },
    )
    if (!ok) return
    setApplying(agency)
    try {
      const result = await api<{ updated: number; label: string }>('/benefits/bulk-deductions', {
        method: 'POST',
        body: JSON.stringify({
          agency,
          monthly_amount: Number(raw),
          branch_id: branchId || null,
        }),
      })
      success(`${result.label}: updated ${result.updated} employee${result.updated === 1 ? '' : 's'}`)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not apply')
    } finally {
      setApplying(null)
    }
  }

  return (
    <div className="card stack">
      <div>
        <h3 className="section-title">Bulk set deductions</h3>
        <p className="form-hint" style={{ marginTop: 0 }}>
          Apply the same monthly deduction to every employee who already has a member ID on file. Employees without
          that ID are skipped — nothing is deducted for them.
        </p>
      </div>

      <div className="form-group" style={{ maxWidth: 280 }}>
        <label>Branch (optional)</label>
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} disabled={loading}>
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Benefit</th>
              <th>Eligible employees</th>
              <th>Monthly amount (₱)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {AGENCIES.map((a) => (
              <tr key={a.key}>
                <td>
                  <strong>{a.label}</strong>
                </td>
                <td>{loading ? '…' : eligible[a.key]}</td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amounts[a.key]}
                    onChange={(e) => setAmounts({ ...amounts, [a.key]: e.target.value })}
                    placeholder="0.00"
                    style={{ maxWidth: 140 }}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={loading || applying === a.key || eligible[a.key] === 0}
                    onClick={() => apply(a.key, a.label)}
                  >
                    {applying === a.key ? 'Applying…' : 'Apply'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
