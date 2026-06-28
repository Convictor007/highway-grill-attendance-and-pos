import { jsonError, jsonOk } from '@/lib/api-response'
import { env } from '@/lib/env'
import { sweepStaleSessions } from '@/lib/attendance-auto'
import { handleRoute } from '@/lib/route-handler'

/**
 * Nightly safety net: closes attendance sessions left open after the crew clocked
 * out (forgotten clock-outs), inheriting co-workers' clock-out time. Triggered by a
 * Vercel Cron job; protected with CRON_SECRET (Vercel sends it as a Bearer token).
 */
export async function GET(request: Request) {
  return handleRoute(async () => {
    const secret = env('CRON_SECRET')
    const isProd = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'
    // Never run unprotected in production: a missing secret means misconfiguration.
    if (!secret) {
      if (isProd) return jsonError('CRON_SECRET is not configured', 503)
    } else {
      const auth = request.headers.get('authorization') ?? ''
      if (auth !== `Bearer ${secret}`) return jsonError('Unauthorized', 401)
    }
    return jsonOk(await sweepStaleSessions())
  })
}
