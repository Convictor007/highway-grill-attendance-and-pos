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
