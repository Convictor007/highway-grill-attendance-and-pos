/** Extract client IP from proxy headers (Vercel / Cloudflare). */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first.slice(0, 45)
  }
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp.slice(0, 45)
  return null
}

export function userAgent(request: Request): string | null {
  const ua = request.headers.get('user-agent')?.trim()
  return ua ? ua.slice(0, 500) : null
}
