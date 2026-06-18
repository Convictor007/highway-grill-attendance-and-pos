import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { BenefitsTabNav } from '../../components/benefits/BenefitsTabNav'
import { BenefitsOverviewPanel } from '../../components/benefits/BenefitsOverviewPanel'
import { BenefitsAgencyPanel } from '../../components/benefits/BenefitsAgencyPanel'
import { BenefitsAllowancesPanel } from '../../components/benefits/BenefitsAllowancesPanel'
import { EmptyState } from '../../components/EmptyState'
import { formatBenefitMoney } from '../../lib/benefitsUi'
import type { BenefitsOverview, BenefitsTab, GovernmentAgency } from '../../types/hrms'

export function BenefitsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<BenefitsTab>('overview')
  const [data, setData] = useState<BenefitsOverview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const eid = user?.employee_id
    if (!eid) {
      setLoading(false)
      return
    }
    setLoading(true)
    api<BenefitsOverview>(`/benefits/overview?employee_id=${encodeURIComponent(eid)}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [user?.employee_id])

  const agency = (id: GovernmentAgency) => data?.agencies.find((a) => a.agency === id)

  return (
    <div>
      <PageHeader
        title="Benefits"
        subtitle="SSS, PhilHealth, Pag-IBIG, allowances, and contribution history"
      />

      <BenefitsTabNav active={tab} onChange={setTab} />

      {loading ? (
        <LoadingBlock />
      ) : !data ? (
        <EmptyState title="Benefits unavailable" description="Could not load your benefit profile." />
      ) : (
        <div style={{ marginTop: '1rem' }}>
          {tab === 'overview' && <BenefitsOverviewPanel data={data} />}

          {tab === 'sss' && agency('sss') && (
            <BenefitsAgencyPanel agency={agency('sss')!} history={data.contribution_history.sss} />
          )}
          {tab === 'philhealth' && agency('philhealth') && (
            <BenefitsAgencyPanel agency={agency('philhealth')!} history={data.contribution_history.philhealth} />
          )}
          {tab === 'pagibig' && agency('pagibig') && (
            <BenefitsAgencyPanel agency={agency('pagibig')!} history={data.contribution_history.pagibig} />
          )}

          {tab === 'tax' && (
            <div className="stack">
              <div className="benefits-stat-grid benefits-stat-grid--3">
                <div className="card benefits-stat-card">
                  <span className="benefits-stat-label">Per payroll (est.)</span>
                  <span className="benefits-stat-value">{formatBenefitMoney(data.withholding_tax.per_payroll)}</span>
                </div>
                <div className="card benefits-stat-card">
                  <span className="benefits-stat-label">Monthly (est.)</span>
                  <span className="benefits-stat-value">{formatBenefitMoney(data.withholding_tax.monthly)}</span>
                </div>
                <div className="card benefits-stat-card">
                  <span className="benefits-stat-label">YTD withheld</span>
                  <span className="benefits-stat-value">{formatBenefitMoney(data.withholding_tax.ytd)}</span>
                </div>
              </div>
              <div className="card table-wrap">
                <h3 className="section-title">Withholding history</h3>
                {data.contribution_history.tax.length === 0 ? (
                  <EmptyState title="No tax withheld yet" description="Amounts appear after payroll is processed." />
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Pay date</th>
                        <th>Period</th>
                        <th>Gross</th>
                        <th>Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.contribution_history.tax.map((row) => (
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
          )}

          {tab === 'allowances' && <BenefitsAllowancesPanel enrollments={data.enrollments} />}
        </div>
      )}
    </div>
  )
}
