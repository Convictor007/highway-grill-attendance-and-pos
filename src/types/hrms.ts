export type Gender = 'male' | 'female' | 'other' | 'prefer_not'

export interface Employee {
  id: string
  branch_id: string
  department_id: string | null
  position_id: string | null
  emp_number: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  address?: string | null
  date_of_birth?: string | null
  gender?: Gender | null
  nationality?: string | null
  national_id?: string | null
  photo_url?: string | null
  emergency_name?: string | null
  emergency_phone?: string | null
  hire_date: string
  employment_type: string
  pay_basis?: 'hourly' | 'daily'
  pay_rate?: string | number | null
  is_stay_in?: number | boolean
  housing_deduction?: string | number | null
  position_min_hourly?: string | number | null
  status: string
  branch_name?: string
  department_name?: string
  position_title?: string
}

export interface Branch {
  id: string
  name: string
  address: string | null
  phone: string | null
  is_active: number
}

export interface Department {
  id: string
  branch_id: string
  name: string
}

export interface Position {
  id: string
  department_id: string
  title: string
  department_name?: string
  pay_grade?: number
  is_tipped?: number
}

export interface Role {
  role_id: number
  role_slug: string
  role_name: string
  role_type?: string
  is_system?: number | boolean
}

export interface AppUser {
  id: string
  email: string
  is_active: number
  account_status?: string
  employee_id: string | null
  role_id?: number
  role_slug: string
  role_name: string
  emp_number?: string
  first_name?: string
  last_name?: string
  employee_status?: string
  position_title?: string
  is_stay_in?: number | boolean
  housing_deduction?: string | number | null
  phone?: string | null
  date_of_birth?: string | null
  gender?: Gender | null
  nationality?: string | null
  national_id?: string | null
  address?: string | null
  emergency_name?: string | null
  emergency_phone?: string | null
  hire_date?: string | null
  employment_type?: string | null
  branch_id?: string | null
  department_id?: string | null
  position_id?: string | null
  last_login_at?: string | null
  created_at?: string | null
  approved_at?: string | null
  activated_at?: string | null
}

export interface ShiftSwapSummary {
  id: string
  status: string
  requester_date: string
  requester_start: string
  requester_end: string
  requester_first?: string
  requester_last?: string
  target_first?: string
  target_last?: string
  created_at?: string
  responded_at?: string | null
}

export interface DashboardSummary {
  date: string
  active_employees: number
  present_today: number
  still_clocked_in: number
  pending_leave: number
  draft_payroll_runs: number
  month_hours?: number
  pending_loans?: number
  attendance_rate_today?: number
}

export interface Holiday {
  id: string
  branch_id: string | null
  holiday_date: string
  name: string
  holiday_type: string
  pay_multiplier: string | number
  branch_name?: string | null
}

export interface PayrollAdjustment {
  id: string
  employee_id: string
  payroll_run_id: string | null
  adj_type: string
  amount: string | number
  description: string | null
  first_name?: string
  last_name?: string
  emp_number?: string
}

export interface TipsPool {
  id: string
  branch_id: string
  pool_date: string
  total_tips: string | number
  shift_type: string
  status: string
  branch_name?: string
  distributions?: TipsDistribution[]
}

export interface TipsDistribution {
  id: string
  employee_id: string
  percentage: string | number
  amount: string | number
  first_name?: string
  last_name?: string
  emp_number?: string
}

export interface BenefitEnrollment {
  id: string
  employee_id: string
  benefit_code: string
  benefit_name: string
  amount: string | number
  frequency: string
  is_active: number | boolean
  notes?: string | null
  first_name?: string
  last_name?: string
}

export type GovernmentAgency = 'sss' | 'philhealth' | 'pagibig'

export type BenefitsTab = 'overview' | GovernmentAgency | 'allowances' | 'tax'

export interface GovernmentProfile {
  employee_id: string
  sss_number: string | null
  philhealth_number: string | null
  pagibig_number: string | null
  tin: string | null
  sss_enrolled: boolean
  philhealth_enrolled: boolean
  pagibig_enrolled: boolean
  notes: string | null
}

export interface BenefitContributionRow {
  payslip_id: string
  pay_date: string
  period_start: string
  period_end: string
  gross_pay: number
  amount: number
}

export interface BenefitsAgencySummary {
  agency: GovernmentAgency
  label: string
  member_id: string | null
  enrolled: boolean
  monthly_employee_share: number
  per_payroll_share: number
  ytd: number
}

export interface BenefitsOverview {
  employee: {
    pay_basis: string
    pay_rate: number
    monthly_compensation: number
    first_name: string
    last_name: string
    emp_number: string
  } | null
  profile: GovernmentProfile
  monthly_compensation: number
  agencies: BenefitsAgencySummary[]
  withholding_tax: {
    monthly: number
    per_payroll: number
    ytd: number
  }
  enrollments: BenefitEnrollment[]
  contribution_history: {
    sss: BenefitContributionRow[]
    philhealth: BenefitContributionRow[]
    pagibig: BenefitContributionRow[]
    tax: BenefitContributionRow[]
  }
  latest_payslip: {
    pay_date: string
    period_start: string
    period_end: string
    sss_amount: number
    philhealth_amount: number
    pagibig_amount: number
    tax_amount: number
    gross_pay: number
    net_pay: number
  } | null
}

export interface OrgMasterlistEntry {
  id: string
  emp_number: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  hire_date: string
  employment_type: string
  status: string
  branch_name?: string
  department_name?: string
  position_title?: string
}

export interface LeaveRequest {
  id: string
  employee_id: string
  leave_type_id: string
  start_date: string
  end_date: string
  days_count: string
  reason: string | null
  status: string
  leave_type_name?: string
  first_name?: string
  last_name?: string
}

export interface LeaveBalance {
  id: string
  employee_id: string
  leave_type_id: string
  year: number
  accrued: string
  used: string
  pending: string
  leave_type_name?: string
  first_name?: string
  last_name?: string
  emp_number?: string
}

export interface AttendanceRecord {
  id: string
  employee_id: string
  clock_in: string
  clock_out: string | null
  actual_hours: string | null
  regular_hours?: string | null
  overtime_hours?: string | null
  clock_out_type?: string | null
  latitude?: string | number | null
  longitude?: string | number | null
  clock_in_address?: string | null
  clock_out_address?: string | null
  first_name?: string
  last_name?: string
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface PayrollRun {
  id: string
  branch_id: string
  period_start: string
  period_end: string
  pay_date: string
  run_type?: string
  pay_frequency?: 'semi_monthly' | 'monthly'
  status: string
  total_gross?: string | number
  total_net?: string | number
  processed_at?: string | null
  branch_name?: string
}

export interface Payslip {
  id: string
  payroll_run_id: string
  employee_id: string
  regular_hours: string
  overtime_hours?: string
  holiday_hours?: string
  basic_pay: string
  overtime_pay?: string
  holiday_pay?: string
  tips_amount?: string
  service_charge?: string
  gross_pay: string
  net_pay: string
  sss_amount: string
  philhealth_amount: string
  pagibig_amount: string
  tax_amount: string
  other_deductions?: string
  loan_deduction?: string
  other_adjustments?: string
  period_start?: string
  period_end?: string
  pay_date?: string
  run_status?: string
  pay_frequency?: string
  run_type?: string
  employment_status?: string
  position_title?: string | null
  department_name?: string | null
  first_name?: string
  last_name?: string
  emp_number?: string
  pay_basis?: string
  pay_rate?: string | number
  payment_status?: PayrollDisbursementStatus
  cash_advance?: string | number
  housing_deduction?: string | number
  tardiness?: string | number
}

export interface PayrollAttendanceDay {
  date: string
  present: boolean
  clock_in: string | null
  clock_out: string | null
  actual_hours: number
  overtime_hours: number
}

export type PayrollDisbursementStatus = 'pending' | 'ready' | 'paid' | 'deferred'

export interface PayrollRosterEntry {
  employee_id: string
  emp_number: string
  first_name: string
  last_name: string
  position_title?: string | null
  department_name?: string | null
  pay_basis: string
  pay_rate: number
  days_or_hours: number
  payslip_id: string | null
  payslip_net: number | null
  payslip_gross: number | null
  payment_status: PayrollDisbursementStatus
  defer_note?: string | null
}

export interface PayrollDisbursementSummary {
  total_employees: number
  pending: number
  ready: number
  paid: number
  deferred: number
  net_ready: number
  net_paid: number
}

export interface PayrollPreparePreview {
  regular_hours: number
  overtime_hours?: number
  basic_pay: number
  gross_pay: number
  sss_amount: number
  philhealth_amount: number
  pagibig_amount: number
  tax_amount: number
  other_deductions: number
  net_pay: number
  loan_deduction?: number
  cash_advance?: number
  housing_deduction?: number
  overtime_pay?: number
  benefits_amount?: number
}

export interface PayrollPrepareData {
  run: PayrollRun
  employee: {
    id: string
    emp_number: string
    first_name: string
    last_name: string
    position_title?: string | null
    department_name?: string | null
  }
  pay_basis: string
  pay_rate: number
  attendance: PayrollAttendanceDay[]
  included_dates: string[]
  preview: PayrollPreparePreview
  loans: { id: string; loan_type?: string; balance: string | number; monthly_deduction: string | number }[]
  adjustments: PayrollAdjustment[]
  payslip: Payslip | null
  can_edit: boolean
}

export interface Schedule {
  id: string
  branch_id: string
  week_start: string
  status: string
  branch_name?: string
}

export interface RosterGridCell {
  date: string
  status?: 'working' | 'day_off' | 'unset'
  label: string
  off: boolean
  assignment_id?: string
  start_time?: string
  end_time?: string
}

export interface RosterGridRow {
  employee_id: string
  display_name: string
  emp_number?: string
  department_name?: string | null
  section_divider: boolean
  cells: RosterGridCell[]
}

export interface RosterGridDay {
  date: string
  label: string
  highlight: boolean
  footnote?: string | null
  day_index?: number
  is_today?: boolean
  is_tomorrow?: boolean
}

export interface RosterGrid {
  title: string
  branch_id: string
  branch_name?: string | null
  schedule_id?: string | null
  schedule_status?: string | null
  editable?: boolean
  current_date?: string
  is_current_week?: boolean
  week_start: string
  week_end: string
  department_id?: string | null
  departments?: { id: string; name: string }[]
  days: RosterGridDay[]
  footnotes: { day_index?: number; day_label: string; text: string }[]
  rows: RosterGridRow[]
}

export interface ShiftAssignment {
  id: string
  schedule_id: string
  employee_id: string
  shift_date: string
  start_time: string
  end_time: string
  first_name?: string
  last_name?: string
  shift_name?: string
}

export interface ShiftTemplate {
  id: string
  branch_id: string
  name: string
  start_time: string
  end_time: string
  break_mins?: number | string
  color_hex?: string | null
  branch_name?: string
}
