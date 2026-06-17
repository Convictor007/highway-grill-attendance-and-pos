import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmptyState } from '../../components/EmptyState'
import { useNotification } from '../../hooks/useNotification'
import { BenefitsTabNav } from '../../components/benefits/BenefitsTabNav'
import { BenefitsOverviewPanel } from '../../components/benefits/BenefitsOverviewPanel'
import { BenefitsAgencyPanel } from '../../components/benefits/BenefitsAgencyPanel'
import { BenefitsAllowancesPanel } from '../../components/benefits/BenefitsAllowancesPanel'
import { GovernmentProfileModal } from '../../components/benefits/GovernmentProfileModal'
import { formatBenefitMoney } from '../../lib/benefitsUi'
import type { BenefitEnrollment, BenefitsOverview, BenefitsTab, Employee, GovernmentAgency } from '../../types/hrms'

export function HrBenefitsPage() {
  const { success, error: notifyError } = useNotification()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeeId, setEmployeeId] = useState('')
  const [tab, setTab] = useState<BenefitsTab>('overview')
  const [data, setData] = useState<BenefitsOverview | null>(null)
  const [allEnrollments, setAllEnrollments] = useState<BenefitEnrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [benefitForm, setBenefitForm] = useState({
    benefit_name: '',
    benefit_code: 'allowance',
    amount: '',
    frequency: 'monthly',
  })

  const loadEmployees = async () => {
    const emps = await api<Employee[]>('/employees?status=active').catch(() => [])
    setEmployees(emps)
    if (!employeeId && emps[0]) setEmployeeId(emps[0].id)
  }

  const loadOverview = async (eid: string) => {
    if (!eid) {
      setData(null)
      return
    }
    setLoading(true)
    try {
      const [overview, enrollments] = await Promise.all([
        api<BenefitsOverview>(`/benefits/overview?employee_id=${encodeURIComponent(eid)}`),
        api<BenefitEnrollment[]>('/benefits').catch(() => []),
      ])
      setData(overview)
      setAllEnrollments(enrollments)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEmployees()
  }, [])

  useEffect(() => {
    if (employeeId) loadOverview(employeeId)
  }, [employeeId])

  const agency = (id: GovernmentAgency) => data?.agencies.find((a) => a.agency === id)
  const selectedEmployee = employees.find((e) => e.id === employeeId)

  const saveProfile = async (payload: Record<string, unknown>) => {
    setSavingProfile(true)
    try {
      await api('/benefits/government-profile', { method: 'PUT', body: JSON.stringify(payload) })
      success('Government profile saved')
      setProfileOpen(false)
      await loadOverview(employeeId)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not save profile')
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Benefits"
        subtitle="Government IDs, contribution estimates, and employee allowances"
      />

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="form-row">
          <div className="form-group" style={{ maxWidth: 360 }}>
            <label>Employee</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Select employee…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.first_name} {e.last_name} ({e.emp_number})
                </option>
              ))}
            </select>
          </div>
          {employeeId && (
            <div className="form-group" style={{ alignSelf: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setProfileOpen(true)}>
                Edit government IDs
              </button>
            </div>
          )}
        </div>
      </div>

      {!employeeId ? (
        <EmptyState title="Select an employee" description="Choose a crew member to view or edit benefits." />
      ) : (
        <>
          <BenefitsTabNav active={tab} onChange={setTab} />

          {loading ? (
            <LoadingBlock />
          ) : !data ? (
            <EmptyState title="Could not load benefits" description="Try again or check the API connection." />
          ) : (
            <div style={{ marginTop: '1rem' }}>
              {tab === 'overview' && <BenefitsOverviewPanel data={data} />}

              {tab === 'sss' && agency('sss') && (
                <BenefitsAgencyPanel
                  agency={agency('sss')!}
                  history={data.contribution_history.sss}
                  canEdit
                  onEdit={() => setProfileOpen(true)}
                />
              )}
              {tab === 'philhealth' && agency('philhealth') && (
                <BenefitsAgencyPanel
                  agency={agency('philhealth')!}
                  history={data.contribution_history.philhealth}
                  canEdit
                  onEdit={() => setProfileOpen(true)}
                />
              )}
              {tab === 'pagibig' && agency('pagibig') && (
                <BenefitsAgencyPanel
                  agency={agency('pagibig')!}
                  history={data.contribution_history.pagibig}
                  canEdit
                  onEdit={() => setProfileOpen(true)}
                />
              )}

              {tab === 'tax' && (
                <div className="card table-wrap">
                  <h3 className="section-title">Withholding tax history — {selectedEmployee?.first_name}</h3>
                  {data.contribution_history.tax.length === 0 ? (
                    <EmptyState title="No tax withheld yet" />
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Pay date</th>
                          <th>Period</th>
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
                            <td>{formatBenefitMoney(row.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {tab === 'allowances' && (
                <BenefitsAllowancesPanel enrollments={data.enrollments} canManage>
                  <form
                    className="card"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      try {
                        await api('/benefits', {
                          method: 'POST',
                          body: JSON.stringify({
                            employee_id: employeeId,
                            ...benefitForm,
                            amount: Number(benefitForm.amount),
                          }),
                        })
                        success('Allowance enrolled')
                        setBenefitForm({ benefit_name: '', benefit_code: 'allowance', amount: '', frequency: 'monthly' })
                        await loadOverview(employeeId)
                      } catch (err) {
                        notifyError(err instanceof Error ? err.message : 'Could not enroll allowance')
                      }
                    }}
                  >
                    <h3 className="section-title">Enroll allowance for {selectedEmployee?.first_name}</h3>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Benefit name</label>
                        <input
                          value={benefitForm.benefit_name}
                          onChange={(e) => setBenefitForm({ ...benefitForm, benefit_name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Code</label>
                        <select
                          value={benefitForm.benefit_code}
                          onChange={(e) => setBenefitForm({ ...benefitForm, benefit_code: e.target.value })}
                        >
                          <option value="allowance">Allowance</option>
                          <option value="meal">Meal</option>
                          <option value="transport">Transport</option>
                          <option value="rice">Rice</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Amount (₱)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={benefitForm.amount}
                          onChange={(e) => setBenefitForm({ ...benefitForm, amount: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary">
                      Enroll
                    </button>
                  </form>
                  <div className="card table-wrap">
                    <h3 className="section-title">All crew allowances</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Benefit</th>
                          <th>Amount</th>
                          <th>Frequency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allEnrollments.map((b) => (
                          <tr key={b.id}>
                            <td>
                              {b.first_name} {b.last_name}
                            </td>
                            <td>{b.benefit_name}</td>
                            <td>{formatBenefitMoney(b.amount)}</td>
                            <td>{b.frequency}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </BenefitsAllowancesPanel>
              )}
            </div>
          )}
        </>
      )}

      <GovernmentProfileModal
        open={profileOpen}
        employeeId={employeeId}
        profile={data?.profile ?? null}
        saving={savingProfile}
        onClose={() => setProfileOpen(false)}
        onSave={saveProfile}
      />
    </div>
  )
}
