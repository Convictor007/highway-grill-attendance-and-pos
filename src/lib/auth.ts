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
