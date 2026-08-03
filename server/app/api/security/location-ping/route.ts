import { requireUser } from '@/lib/auth'
import { jsonOk } from '@/lib/api-response'
import { recordLocationPing } from '@/lib/location-tracking'
import { handleRoute } from '@/lib/route-handler'

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    const body = (await request.json()) as Record<string, unknown>
    await recordLocationPing(user, {
      latitude: Number(body.latitude),
      longitude: Number(body.longitude),
      accuracy_m: body.accuracy_m != null ? Number(body.accuracy_m) : null,
      altitude_m: body.altitude_m != null ? Number(body.altitude_m) : null,
      speed_mps: body.speed_mps != null ? Number(body.speed_mps) : null,
      heading_deg: body.heading_deg != null ? Number(body.heading_deg) : null,
      source: (body.source as 'background' | 'foreground' | 'manual') ?? 'background',
    })
    return jsonOk({ ok: true })
  })
}
