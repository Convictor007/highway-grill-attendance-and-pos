import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmptyState } from '../../components/EmptyState'
import { useNotification } from '../../hooks/useNotification'
import { BenefitsTabNav } from '../../components/benefits/BenefitsTabNav'
import { BenefitsAllowancesPanel } from '../../components/benefits/BenefitsAllowancesPanel'
import { BenefitsCompliancePanel } from '../../components/benefits/BenefitsCompliancePanel'
import { BenefitsRemittancePanel } from '../../components/benefits/BenefitsRemittancePanel'
import { GovernmentProfileForm } from '../../components/benefits/GovernmentProfileForm'
import { BenefitEnrollmentModal } from '../../components/benefits/BenefitEnrollmentModal'
import { HR_BENEFITS_TABS } from '../../lib/benefitsUi'
import type {
  BenefitEnrollment,
  BenefitsComplianceReport,
  BenefitsRemittanceSummary,
  BenefitsTab,
  Branch,
  Employee,
  GovernmentProfile,
} from '../../types/hrms'

export function HrBenefitsPage() {
  const { success, error: notifyError, confirm } = useNotification()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [employeeId, setEmployeeId] = useState('')
  const [tab, setTab] = useState<BenefitsTab>('government')
  const [profile, setProfile] = useState<GovernmentProfile | null>(null)
  const [enrollments, setEnrollments] = useState<BenefitEnrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [enrollmentOpen, setEnrollmentOpen] = useState(false)
  const [editingEnrollment, setEditingEnrollment] = useState<BenefitEnrollment | null>(null)
  const [savingEnrollment, setSavingEnrollment] = useState(false)
  const [compliance, setCompliance] = useState<BenefitsComplianceReport | null>(null)
  const [complianceLoading, setComplianceLoading] = useState(false)
  const [complianceBranch, setComplianceBranch] = useState('')
  const [remittance, setRemittance] = useState<BenefitsRemittanceSummary | null>(null)
  const [remittanceLoading, setRemittanceLoading] = useState(false)
  const [remittanceBranch, setRemittanceBranch] = useState('')
  const [remittanceYear, setRemittanceYear] = useState(() => new Date().getFullYear())
  const [remittanceMonth, setRemittanceMonth] = useState(() => new Date().getMonth() + 1)

  const loadEmployees = async () => {
    const [emps, branchRows] = await Promise.all([
      api<Employee[]>('/employees?status=active').catch(() => []),
      api<Branch[]>('/branches').catch(() => []),
    ])
    setEmployees(emps)
    setBranches(branchRows)
    if (!employeeId && emps[0]) setEmployeeId(emps[0].id)
  }

  const loadEmployeeBenefits = async (eid: string) => {
    if (!eid) {
      setProfile(null)
      setEnrollments([])
      return
    }
    setLoading(true)
    try {
      const [profileRow, enrollmentRows] = await Promise.all([
        api<GovernmentProfile | null>(`/benefits/government-profile?employee_id=${encodeURIComponent(eid)}`).catch(
          () => null,
        ),
        api<BenefitEnrollment[]>(`/benefits?employee_id=${encodeURIComponent(eid)}`).catch(() => []),
      ])
      setProfile(profileRow)
      setEnrollments(enrollmentRows)
    } catch {
      setProfile(null)
      setEnrollments([])
    } finally {
      setLoading(false)
    }
  }

  const loadCompliance = async (branchId: string) => {
    setComplianceLoading(true)
    try {
      const q = branchId ? `?branch_id=${encodeURIComponent(branchId)}` : ''
      setCompliance(await api<BenefitsComplianceReport>(`/benefits/compliance${q}`))
    } catch {
      setCompliance(null)
    } finally {
      setComplianceLoading(false)
    }
  }

  const loadRemittance = async (year: number, month: number, branchId: string) => {
    setRemittanceLoading(true)
    try {
      const params = new URLSearchParams({ year: String(year), month: String(month) })
      if (branchId) params.set('branch_id', branchId)
      setRemittance(await api<BenefitsRemittanceSummary>(`/benefits/remittance?${params}`))
    } catch {
      setRemittance(null)
    } finally {
      setRemittanceLoading(false)
    }
  }

  useEffect(() => {
    loadEmployees()
  }, [])

  useEffect(() => {
    if (employeeId) loadEmployeeBenefits(employeeId)
  }, [employeeId])

  useEffect(() => {
    if (tab === 'compliance') loadCompliance(complianceBranch)
  }, [tab, complianceBranch])

  useEffect(() => {
    if (tab === 'remittance') loadRemittance(remittanceYear, remittanceMonth, remittanceBranch)
  }, [tab, remittanceYear, remittanceMonth, remittanceBranch])

  const selectedEmployee = employees.find((e) => e.id === employeeId)
  const employeeLabel = selectedEmployee
    ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}`
    : undefined

  const saveProfile = async (payload: Record<string, unknown>) => {
    setSavingProfile(true)
    try {
      await api('/benefits/government-profile', { method: 'PUT', body: JSON.stringify(payload) })
      success('Saved')
      await loadEmployeeBenefits(employeeId)
      if (tab === 'compliance') await loadCompliance(complianceBranch)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not save')
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
        await api(`/benefits/${editingEnrollment.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        success('Allowance updated')
      } else {
        await api('/benefits', { method: 'POST', body: JSON.stringify(payload) })
        success('Allowance added')
      }
      setEnrollmentOpen(false)
      setEditingEnrollment(null)
      await loadEmployeeBenefits(employeeId)
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
      await loadEmployeeBenefits(employeeId)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not delete allowance')
    }
  }

  const fixEmployeeFromCompliance = (eid: string) => {
    setEmployeeId(eid)
    setTab('government')
  }

  const showEmployeePanels = tab !== 'compliance' && tab !== 'remittance'

  return (
    <div>
      <PageHeader title="Benefits" subtitle="Government IDs, allowances, compliance, and remittance" />

      <BenefitsTabNav active={tab} onChange={setTab} tabs={HR_BENEFITS_TABS} />

      {tab === 'compliance' && (
        <div style={{ marginTop: '1rem' }}>
          <BenefitsCompliancePanel
            report={compliance}
            loading={complianceLoading}
            branchFilter={complianceBranch}
            branches={branches}
            onBranchChange={setComplianceBranch}
            onFixEmployee={fixEmployeeFromCompliance}
          />
        </div>
      )}

      {tab === 'remittance' && (
        <div style={{ marginTop: '1rem' }}>
          <BenefitsRemittancePanel
            summary={remittance}
            loading={remittanceLoading}
            year={remittanceYear}
            month={remittanceMonth}
            branchFilter={remittanceBranch}
            branches={branches}
            onYearChange={setRemittanceYear}
            onMonthChange={setRemittanceMonth}
            onBranchChange={setRemittanceBranch}
          />
        </div>
      )}

      {showEmployeePanels && (
        <div className="card" style={{ margin: '1rem 0' }}>
          <div className="form-group" style={{ maxWidth: 360, margin: 0 }}>
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
      )}

      {showEmployeePanels && !employeeId ? (
        <EmptyState title="Select an employee" description="Choose a crew member to manage benefits." />
      ) : showEmployeePanels ? (
        loading ? (
          <LoadingBlock />
        ) : (
          <div className="stack" style={{ marginTop: '0.5rem' }}>
            {tab === 'government' && (
              <GovernmentProfileForm
                employeeId={employeeId}
                profile={profile}
                saving={savingProfile}
                onSave={saveProfile}
              />
            )}

            {tab === 'allowances' && (
              <BenefitsAllowancesPanel
                enrollments={enrollments}
                canManage
                onAdd={openAddAllowance}
                onEdit={openEditAllowance}
                onDelete={deleteEnrollment}
              />
            )}
          </div>
        )
      ) : null}

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
