import { api } from './api'
import type { AuthUser } from '../types/roles'

const TOKEN_KEY = 'hg_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await api<{
    token: string
    user: AuthUser
    permissions: string[]
  }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setToken(data.token)
  return { ...data.user, permissions: data.permissions }
}

export async function fetchMe(): Promise<AuthUser> {
  const data = await api<AuthUser & { permissions?: string[] }>('/auth/me')
  return {
    ...data,
    permissions: data.permissions ?? [],
  }
}

export async function register(payload: {
  first_name: string
  last_name: string
  email: string
  password: string
  branch_id: string
  phone?: string
  department_id?: string
  position_id?: string
  date_of_birth?: string
  gender?: string
  nationality?: string
  address?: string
  emergency_name?: string
  emergency_phone?: string
  employment_type?: string
}): Promise<{ message: string; emp_number: string; account_status: string }> {
  return api('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function logout(): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST' })
  } finally {
    clearAuth()
  }
}

export function hasPermission(user: AuthUser | null, key: string): boolean {
  return user?.permissions?.includes(key) ?? false
}
