/** Resolve stored upload paths for the browser (Vite dev proxy → Node server). */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path
  }
  return path.startsWith('/') ? path : `/${path}`
}
