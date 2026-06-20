export const RoleSlug = {
  Admin: 'admin',
  Hr: 'hr',
  Employee: 'employee',
} as const

export type RoleSlug = (typeof RoleSlug)[keyof typeof RoleSlug]

export type AccountStatus = 'awaiting_hr' | 'pending' | 'active' | 'rejected'

export interface AuthUser {
  id: string
  email: string
  role_id: number
  role_slug: RoleSlug
  role_name: string
  employee_id: string | null
  account_status?: AccountStatus
  is_active?: number
  permissions: string[]
  employee?: {
    id: string
    emp_number: string
    first_name: string
    last_name: string
    branch_id: string
    department_id?: string | null
    position_id?: string | null
    status: string
    worker_class?: 'regular' | 'on_call'
    photo_url?: string | null
    gender?: string | null
    date_of_birth?: string | null
  } | null
}
