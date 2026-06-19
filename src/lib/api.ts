const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('hg_token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const json = await res.json().catch(() => ({}))

  if (!res.ok || json.success === false) {
    throw new ApiError(json.error ?? res.statusText, res.status)
  }

  return json.data as T
}

export async function apiDownload(path: string, fallbackFilename = 'download'): Promise<void> {
  const token = localStorage.getItem('hg_token')
  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, { headers })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new ApiError(json.error ?? res.statusText, res.status)
  }

  const blob = await res.blob()
  const disp = res.headers.get('Content-Disposition')
  const match = disp?.match(/filename="?([^";]+)"?/)
  const filename = match?.[1] ?? fallbackFilename
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = localStorage.getItem('hg_token')
  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: formData })
  const json = await res.json().catch(() => ({}))

  if (!res.ok || json.success === false) {
    throw new ApiError(json.error ?? res.statusText, res.status)
  }

  return json.data as T
}
