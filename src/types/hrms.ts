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
  emergency_name?: string | null
  emergency_phone?: string | null
  hire_date: string
  employment_type: string
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
  employee_id: string | null
  role_id?: number
  role_slug: string
  role_name: string
  emp_number?: string
  first_name?: string
  last_name?: string
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

export interface PayrollRun {
  id: string
  branch_id: string
  period_start: string
  period_end: string
  pay_date: string
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
  tips_amount?: string
  service_charge?: string
  gross_pay: string
  net_pay: string
  sss_amount: string
  philhealth_amount: string
  pagibig_amount: string
  tax_amount: string
  other_deductions?: string
  period_start?: string
  period_end?: string
  pay_date?: string
  run_status?: string
  first_name?: string
  last_name?: string
  emp_number?: string
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
  footnote?: string
  is_today?: boolean
  is_tomorrow?: boolean
}

export interface RosterGrid {
  title: string
  branch_id: string
  branch_name?: string | null
  current_date?: string
  is_current_week?: boolean
  week_start: string
  week_end: string
  days: RosterGridDay[]
  footnotes: { day_label: string; text: string }[]
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
