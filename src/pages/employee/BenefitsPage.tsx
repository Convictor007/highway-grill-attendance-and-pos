import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmptyState } from '../../components/EmptyState'
import type { BenefitEnrollment } from '../../types/hrms'

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
  service_charge?: string
}

function money(v: string | number | undefined | null) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n) ? `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'
}

export function BenefitsPage() {
  const { user } = useAuth()
  const [latest, setLatest] = useState<PayslipBenefits | null>(null)
  const [enrollments, setEnrollments] = useState<BenefitEnrollment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const eid = user?.employee_id
    if (!eid) {
      setLoading(false)
      return
    }
    Promise.all([
      api<PayslipBenefits[]>('/payroll/my-payslips').catch(() => [] as PayslipBenefits[]),
      api<BenefitEnrollment[]>(`/benefits?employee_id=${encodeURIComponent(eid)}`).catch(
        () => [] as BenefitEnrollment[]
      ),
    ])
      .then(([payslips, benefits]) => {
        setLatest(payslips[0] ?? null)
        setEnrollments(benefits.filter((b) => b.is_active))
      })
      .finally(() => setLoading(false))
  }, [user?.employee_id])

  return (
    <div>
      <PageHeader
        title="Benefits"
        subtitle="Allowances, government contributions, and enrolled benefits"
      />
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 className="section-title">Enrolled benefits</h3>
        {loading ? (
          <LoadingBlock />
        ) : enrollments.length === 0 ? (
          <EmptyState title="No enrolled benefits" description="HR can add meal, transport, or other allowances." />
        ) : (
          <ul className="doc-list">
            {enrollments.map((b) => (
              <li key={b.id} className="doc-row">
                <div>
                  <strong>{b.benefit_name}</strong>
                  <span className="doc-meta">
                    {b.benefit_code} · {b.frequency}
                  </span>
                </div>
                <span>{money(b.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3 className="section-title">Latest payslip deductions</h3>
        {loading ? (
          <LoadingBlock />
        ) : !latest ? (
          <EmptyState title="No payslip data yet" description="Contributions appear after HR processes payroll." />
        ) : (
          <>
            <p className="muted-block" style={{ marginBottom: '1rem' }}>
              Based on pay date <strong>{latest.pay_date}</strong> ({latest.period_start} – {latest.period_end})
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
              {latest.service_charge != null && Number(latest.service_charge) > 0 && (
                <div>
                  <dt>Benefits / allowances</dt>
                  <dd>{money(latest.service_charge)}</dd>
                </div>
              )}
              <div className="benefits-dl-total">
                <dt>Net pay</dt>
                <dd>
                  <strong>{money(latest.net_pay)}</strong>
                </dd>
              </div>
            </dl>
          </>
        )}
      </div>
    </div>
  )
}
