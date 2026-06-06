export const RoleSlug = {
  Admin: 'admin',
  Hr: 'hr',
  Employee: 'employee',
} as const

export type RoleSlug = (typeof RoleSlug)[keyof typeof RoleSlug]

export interface AuthUser {
  id: string
  email: string
  role_id: number
  role_slug: RoleSlug
  role_name: string
  employee_id: string | null
  permissions: string[]
  employee?: {
    id: string
    emp_number: string
    first_name: string
    last_name: string
    branch_id: string
    status: string
  } | null
}
