type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/** Simple in-memory rate limiter (per key). */
export function checkRateLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  if (bucket.count >= max) {
    throw new Error('Too many requests. Please try again later.')
  }
  bucket.count += 1
}

/** Returns current count for a key within the active window (for threat scoring). */
export function rateLimitCount(key: string, windowMs: number): number {
  const bucket = buckets.get(key)
  if (!bucket || Date.now() >= bucket.resetAt) return 0
  return bucket.count
}

const LOGIN_MAX = 12
const LOGIN_WINDOW_MS = 15 * 60 * 1000

export function assertLoginRateLimit(ip: string | null): void {
  const key = `login:${ip || 'unknown'}`
  checkRateLimit(key, LOGIN_MAX, LOGIN_WINDOW_MS)
}

export function loginAttemptCount(ip: string | null): number {
  return rateLimitCount(`login:${ip || 'unknown'}`, LOGIN_WINDOW_MS)
}
