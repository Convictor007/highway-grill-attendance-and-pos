/**
 * Notification links must be in-app paths. Older rows may store full URLs
 * (e.g. http://localhost:5173/payroll) — strip to pathname for React Router.
 */
export function resolveNotificationLink(link: string | null | undefined): string | null {
  if (link == null) return null
  const trimmed = link.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed
  try {
    const url = new URL(trimmed)
    const path = `${url.pathname}${url.search}${url.hash}`
    return path.startsWith('/') ? path : `/${path}`
  } catch {
    if (!trimmed.includes('://')) {
      return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
    }
    return null
  }
}
