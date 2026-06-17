import { requireUser } from '@/lib/auth'
import { jsonError, jsonOk } from '@/lib/api-response'
import { search } from '@/lib/geocode'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    await requireUser(request)
    const q = (new URL(request.url).searchParams.get('q') ?? '').trim()
    if (!q) return jsonError('q query parameter required', 422)
    return jsonOk(await search(q))
  })
}
