import { register } from '@/lib/registration'
import { logAuthEvent } from '@/lib/auth-events'
import { clientIp, userAgent } from '@/lib/client-ip'
import { jsonOk } from '@/lib/api-response'
import { handleRoute } from '@/lib/route-handler'

export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = (await request.json()) as Record<string, unknown>
    const data = await register(body)
    await logAuthEvent({
      eventType: 'register_submitted',
      email: String(body.email ?? ''),
      ipAddress: clientIp(request),
      userAgent: userAgent(request),
      meta: {
        emp_number: data.emp_number,
        branch_id: body.branch_id ?? null,
      },
    })
    return jsonOk(data, 201)
  })
}
