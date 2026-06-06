import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmptyState } from '../../components/EmptyState'

interface PayslipBenefits {
  id: string
  pay_date: string
  period_start: string
  period_end: string
  sss_amount: string
  philhealth_amount: string
  pagibig_amount: string
  tax_amount: string
  gross_pay: string
  net_pay: string
}

function money(v: string | number) {
  const n = Number(v)
  return Number.isFinite(n) ? `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'
}

export function BenefitsPage() {
  const [latest, setLatest] = useState<PayslipBenefits | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<PayslipBenefits[]>('/payroll/my-payslips')
      .then((rows) => setLatest(rows[0] ?? null))
      .catch(() => setLatest(null))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader
        title="Benefits"
        subtitle="Government contributions and deductions from your latest payslip"
      />
      <div className="card">
        {loading ? (
          <LoadingBlock />
        ) : !latest ? (
          <EmptyState
            title="No payslip data yet"
            description="Contributions appear after HR processes payroll."
          />
        ) : (
          <>
            <p className="muted-block" style={{ marginBottom: '1rem' }}>
              Based on pay date <strong>{latest.pay_date}</strong> (
              {latest.period_start} – {latest.period_end})
            </p>
            <dl className="benefits-dl">
              <div>
                <dt>SSS</dt>
                <dd>{money(latest.sss_amount)}</dd>
              </div>
              <div>
                <dt>PhilHealth</dt>
                <dd>{money(latest.philhealth_amount)}</dd>
              </div>
              <div>
                <dt>Pag-IBIG</dt>
                <dd>{money(latest.pagibig_amount)}</dd>
              </div>
              <div>
                <dt>Withholding tax</dt>
                <dd>{money(latest.tax_amount)}</dd>
              </div>
              <div className="benefits-dl-total">
                <dt>Gross pay</dt>
                <dd>{money(latest.gross_pay)}</dd>
              </div>
              <div className="benefits-dl-total">
                <dt>Net pay</dt>
                <dd>
                  <strong>{money(latest.net_pay)}</strong>
                </dd>
              </div>
            </dl>
            <p className="muted-block" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
              For full payslip history, open <strong>My Payroll</strong> in the menu.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
