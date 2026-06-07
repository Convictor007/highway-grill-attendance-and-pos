/** Resolve stored upload paths for browser (dev proxy + XAMPP). */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path
  }
  if (path.startsWith('/api/')) return path
  if (path.startsWith('/HG_web/')) return path
  return `/api${path.startsWith('/') ? path : `/${path}`}`
}
