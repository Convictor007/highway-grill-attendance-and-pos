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
import { BenefitsManagementBar } from '../../components/benefits/BenefitsManagementBar'
import { GovernmentProfileModal } from '../../components/benefits/GovernmentProfileModal'
import { BenefitEnrollmentModal } from '../../components/benefits/BenefitEnrollmentModal'
import { formatBenefitMoney } from '../../lib/benefitsUi'
import type { BenefitEnrollment, BenefitsOverview, BenefitsTab, Employee, GovernmentAgency } from '../../types/hrms'

export function HrBenefitsPage() {
  const { success, error: notifyError, confirm } = useNotification()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeeId, setEmployeeId] = useState('')
  const [tab, setTab] = useState<BenefitsTab>('overview')
  const [data, setData] = useState<BenefitsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [enrollmentOpen, setEnrollmentOpen] = useState(false)
  const [editingEnrollment, setEditingEnrollment] = useState<BenefitEnrollment | null>(null)
  const [savingEnrollment, setSavingEnrollment] = useState(false)

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
      setData(await api<BenefitsOverview>(`/benefits/overview?employee_id=${encodeURIComponent(eid)}`))
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
  const employeeLabel = selectedEmployee
    ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}`
    : undefined

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

  const openAddAllowance = () => {
    setEditingEnrollment(null)
    setEnrollmentOpen(true)
    setTab('allowances')
  }

  const openEditAllowance = (enrollment: BenefitEnrollment) => {
    setEditingEnrollment(enrollment)
    setEnrollmentOpen(true)
  }

  const saveEnrollment = async (payload: Record<string, unknown>) => {
    setSavingEnrollment(true)
    try {
      if (editingEnrollment) {
        await api(`/benefits/${editingEnrollment.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        success('Allowance updated')
      } else {
        await api('/benefits', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        success('Allowance added')
      }
      setEnrollmentOpen(false)
      setEditingEnrollment(null)
      await loadOverview(employeeId)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not save allowance')
    } finally {
      setSavingEnrollment(false)
    }
  }

  const deleteEnrollment = async (enrollment: BenefitEnrollment) => {
    const ok = await confirm(`Delete "${enrollment.benefit_name}" for ${employeeLabel}?`, {
      title: 'Delete allowance',
      variant: 'danger',
      confirmLabel: 'Delete',
    })
    if (!ok) return
    try {
      await api(`/benefits/${enrollment.id}`, { method: 'DELETE' })
      success('Allowance deleted')
      await loadOverview(employeeId)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not delete allowance')
    }
  }

  return (
    <div>
      <PageHeader
        title="Benefits"
        subtitle="Manage government IDs, contributions, and allowances per employee"
      />

      <div className="card" style={{ marginBottom: '1rem' }}>
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
      </div>

      {!employeeId ? (
        <EmptyState title="Select an employee" description="Choose a crew member to view or manage benefits." />
      ) : (
        <>
          <BenefitsTabNav active={tab} onChange={setTab} />

          {loading ? (
            <LoadingBlock />
          ) : !data ? (
            <EmptyState title="Could not load benefits" description="Try again or check the API connection." />
          ) : (
            <div className="stack" style={{ marginTop: '1rem' }}>
              <BenefitsManagementBar
                data={data}
                onEditGovernment={() => setProfileOpen(true)}
                onAddAllowance={openAddAllowance}
              />

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
                <div className="stack">
                  <div className="card">
                    <div className="benefits-panel-head">
                      <div>
                        <h3 className="section-title">Withholding tax</h3>
                        <p className="form-hint" style={{ marginTop: 0 }}>
                          TIN and tax withheld are based on the employee&apos;s government profile and payroll runs.
                        </p>
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setProfileOpen(true)}>
                        Edit TIN
                      </button>
                    </div>
                    <p className="muted-block" style={{ margin: 0 }}>
                      TIN on file: <strong>{data.profile?.tin?.trim() || 'Not set'}</strong>
                    </p>
                  </div>
                  <div className="card table-wrap">
                    <h3 className="section-title">Withholding tax history</h3>
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
                </div>
              )}

              {tab === 'allowances' && (
                <BenefitsAllowancesPanel
                  enrollments={data.enrollments}
                  canManage
                  onAdd={openAddAllowance}
                  onEdit={openEditAllowance}
                  onDelete={deleteEnrollment}
                />
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

      <BenefitEnrollmentModal
        open={enrollmentOpen}
        employeeId={employeeId}
        employeeName={employeeLabel}
        editing={editingEnrollment}
        saving={savingEnrollment}
        onClose={() => {
          setEnrollmentOpen(false)
          setEditingEnrollment(null)
        }}
        onSave={saveEnrollment}
      />
    </div>
  )
}
