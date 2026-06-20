import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { Modal } from './Modal'
import { DatePicker } from './DatePicker'
import { AddressField } from './AddressField'
import { NationalityField, DEFAULT_NATIONALITY } from './NationalityField'
import type { Branch, Department, Employee, Gender, Position } from '../types/hrms'

export type EmployeeFormState = {
  branch_id: string
  department_id: string
  position_id: string
  emp_number: string
  first_name: string
  last_name: string
  email: string
  phone: string
  hire_date: string
  status: string
  employment_type: string
  worker_class: 'regular' | 'on_call'
  date_of_birth: string
  gender: Gender | ''
  nationality: string
  address: string
  emergency_name: string
  emergency_phone: string
  pay_basis: 'hourly' | 'daily'
  pay_rate: string
  is_stay_in: boolean
  housing_deduction: string
}

const FORM_ID = 'employee-edit-form'

function emptyForm(branchId = ''): EmployeeFormState {
  return {
    branch_id: branchId,
    department_id: '',
    position_id: '',
    emp_number: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    hire_date: new Date().toISOString().slice(0, 10),
    status: 'active',
    employment_type: 'full_time',
    worker_class: 'on_call' as const,
    date_of_birth: '',
    gender: '',
    nationality: DEFAULT_NATIONALITY,
    address: '',
    emergency_name: '',
    emergency_phone: '',
    pay_basis: 'hourly',
    pay_rate: '',
    is_stay_in: false,
    housing_deduction: '',
  }
}

function formFromEmployee(emp: Employee): EmployeeFormState {
  return {
    branch_id: emp.branch_id,
    department_id: emp.department_id ?? '',
    position_id: emp.position_id ?? '',
    emp_number: emp.emp_number,
    first_name: emp.first_name,
    last_name: emp.last_name,
    email: emp.email ?? '',
    phone: emp.phone ?? '',
    hire_date: emp.hire_date?.slice(0, 10) ?? '',
    status: emp.status,
    employment_type: emp.employment_type ?? 'full_time',
    worker_class: emp.worker_class === 'on_call' ? 'on_call' : 'regular',
    date_of_birth: emp.date_of_birth?.slice(0, 10) ?? '',
    gender: (emp.gender as Gender) ?? '',
    nationality: emp.nationality || DEFAULT_NATIONALITY,
    address: emp.address ?? '',
    emergency_name: emp.emergency_name ?? '',
    emergency_phone: emp.emergency_phone ?? '',
    pay_basis: emp.pay_basis === 'daily' ? 'daily' : 'hourly',
    pay_rate: emp.pay_rate != null && emp.pay_rate !== '' ? String(emp.pay_rate) : '',
    is_stay_in: Boolean(emp.is_stay_in),
    housing_deduction:
      emp.housing_deduction != null && emp.housing_deduction !== '' ? String(emp.housing_deduction) : '',
  }
}

type Props = {
  open: boolean
  employee: Employee | null
  isNew?: boolean
  branches: Branch[]
  onClose: () => void
  onSaved: () => void
}

export function EmployeeEditModal({ open, employee, isNew = false, branches, onClose, onSaved }: Props) {
  const [form, setForm] = useState<EmployeeFormState>(() => emptyForm(branches[0]?.id ?? ''))
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDepts = async (branchId: string) => {
    if (!branchId) return setDepartments([])
    setDepartments(await api<Department[]>(`/departments?branch_id=${branchId}`))
  }

  const loadPositions = async (branchId: string) => {
    if (!branchId) return setPositions([])
    setPositions(await api<Position[]>(`/positions?branch_id=${branchId}`))
  }

  useEffect(() => {
    if (!open) return
    setError(null)
    const init = async () => {
      if (isNew) {
        const branchId = branches[0]?.id ?? ''
        setForm(emptyForm(branchId))
        await loadDepts(branchId)
        await loadPositions(branchId)
        return
      }
      if (!employee) return
      setForm(formFromEmployee(employee))
      await loadDepts(employee.branch_id)
      await loadPositions(employee.branch_id)
    }
    void init()
  }, [open, employee?.id, isNew, branches])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const payload = {
      ...form,
      department_id: form.department_id || null,
      position_id: form.position_id || null,
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      nationality: form.nationality || DEFAULT_NATIONALITY,
      address: form.address || null,
      emergency_name: form.emergency_name || null,
      emergency_phone: form.emergency_phone || null,
      pay_basis: form.pay_basis,
      pay_rate: form.pay_rate !== '' ? Number(form.pay_rate) : null,
      is_stay_in: form.is_stay_in,
      housing_deduction: form.is_stay_in && form.housing_deduction !== '' ? Number(form.housing_deduction) : 0,
    }
    setSaving(true)
    try {
      if (isNew) {
        await api('/employees', { method: 'POST', body: JSON.stringify(payload) })
      } else if (employee) {
        await api(`/employees/${employee.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save employee')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const title = isNew ? 'New employee' : `Edit — ${employee?.first_name ?? ''} ${employee?.last_name ?? ''}`.trim()

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      size="large"
      panelClassName="employee-edit-modal-panel"
      closeOnBackdropClick={!saving}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form={FORM_ID} className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id={FORM_ID} className="employee-edit-form" onSubmit={onSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>Employee #</label>
            <input
              value={form.emp_number}
              onChange={(e) => setForm({ ...form, emp_number: e.target.value })}
              required
              disabled={!isNew}
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="pending">pending</option>
              <option value="active">active</option>
              <option value="on_leave">on_leave</option>
              <option value="resigned">resigned</option>
              <option value="terminated">terminated</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Branch</label>
          <select
            value={form.branch_id}
            onChange={async (e) => {
              const bid = e.target.value
              setForm({ ...form, branch_id: bid, department_id: '', position_id: '' })
              await loadDepts(bid)
              await loadPositions(bid)
            }}
            required
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Department</label>
            <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Position</label>
            <select value={form.position_id} onChange={(e) => setForm({ ...form, position_id: e.target.value })}>
              <option value="">—</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>First name</label>
            <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Last name</label>
            <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <DatePicker
            label="Birthday"
            value={form.date_of_birth}
            onChange={(date_of_birth) => setForm({ ...form, date_of_birth })}
            max={new Date().toISOString().slice(0, 10)}
          />
          <div className="form-group">
            <label>Gender</label>
            <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as Gender | '' })}>
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not">Prefer not to say</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <NationalityField value={form.nationality} onChange={(nationality) => setForm({ ...form, nationality })} />
          <DatePicker
            label="Date hired"
            value={form.hire_date}
            onChange={(hire_date) => setForm({ ...form, hire_date })}
            max={new Date().toISOString().slice(0, 10)}
            required
          />
        </div>
        <AddressField value={form.address} onChange={(address) => setForm({ ...form, address })} compact />
        <div className="form-row">
          <div className="form-group">
            <label>Emergency contact</label>
            <input value={form.emergency_name} onChange={(e) => setForm({ ...form, emergency_name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Emergency phone</label>
            <input value={form.emergency_phone} onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label>Employment type</label>
          <select value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value })}>
            <option value="full_time">Full time</option>
            <option value="part_time">Part time</option>
            <option value="casual">Casual</option>
            <option value="seasonal">Seasonal</option>
          </select>
        </div>
        <div className="form-group">
          <label>Worker class</label>
          <select
            value={form.worker_class}
            onChange={(e) => setForm({ ...form, worker_class: e.target.value as 'regular' | 'on_call' })}
          >
            <option value="regular">Regular (paid leave, 13th month)</option>
            <option value="on_call">On-call (no paid leave, no 13th month)</option>
          </select>
          <p className="form-hint" style={{ marginBottom: 0 }}>
            On-call staff can be promoted to regular when they qualify for full benefits.
          </p>
        </div>
        <fieldset className="form-fieldset">
          <legend>Payroll compensation</legend>
          <p className="form-hint" style={{ marginTop: 0 }}>
            Used when generating payslips. SSS, PhilHealth, Pag-IBIG, and tax are computed automatically from gross pay
            (Philippine rules) — you do not enter those per employee.
          </p>
          <div className="form-row">
            <div className="form-group">
              <label>Pay basis</label>
              <select
                value={form.pay_basis}
                onChange={(e) => setForm({ ...form, pay_basis: e.target.value as 'hourly' | 'daily' })}
              >
                <option value="hourly">Hourly (hours × rate)</option>
                <option value="daily">Daily (days worked × rate)</option>
              </select>
            </div>
            <div className="form-group">
              <label>{form.pay_basis === 'daily' ? 'Daily rate (₱)' : 'Hourly rate (₱)'}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Optional pay rate override"
                value={form.pay_rate}
                onChange={(e) => setForm({ ...form, pay_rate: e.target.value })}
              />
            </div>
          </div>
        </fieldset>
        <fieldset className="form-fieldset">
          <legend>Stay-in housing</legend>
          <p className="form-hint" style={{ marginTop: 0 }}>
            Deducted each payroll run and shown on the payslip as <strong>HSNG</strong>.
          </p>
          <label className="checkbox-row employee-edit-checkbox">
            <input
              type="checkbox"
              checked={form.is_stay_in}
              onChange={(e) =>
                setForm({
                  ...form,
                  is_stay_in: e.target.checked,
                  housing_deduction: e.target.checked ? form.housing_deduction : '',
                })
              }
            />
            <span>Employee uses company stay-in housing</span>
          </label>
          {form.is_stay_in && (
            <div className="form-group">
              <label>Housing deduction per month (₱)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 1000 — half per semi-monthly run"
                value={form.housing_deduction}
                onChange={(e) => setForm({ ...form, housing_deduction: e.target.value })}
              />
            </div>
          )}
        </fieldset>
        {error && <p className="error-msg">{error}</p>}
      </form>
    </Modal>
  )
}
