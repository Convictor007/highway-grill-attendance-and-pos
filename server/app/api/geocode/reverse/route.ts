import { requireUser } from '@/lib/auth'
import { jsonError, jsonOk } from '@/lib/api-response'
import { reverse } from '@/lib/geocode'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    await requireUser(request)
    const url = new URL(request.url)
    const lat = url.searchParams.get('lat') ?? url.searchParams.get('latitude')
    const lng = url.searchParams.get('lng') ?? url.searchParams.get('longitude')
    if (lat == null || lng == null) return jsonError('lat and lng query parameters required', 422)
    return jsonOk(await reverse(Number(lat), Number(lng)))
  })
}
