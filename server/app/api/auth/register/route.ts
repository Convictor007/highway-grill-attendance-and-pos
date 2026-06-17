import { register } from '@/lib/registration'
import { jsonOk } from '@/lib/api-response'
import { handleRoute } from '@/lib/route-handler'

export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = (await request.json()) as Record<string, unknown>
    const data = await register(body)
    return jsonOk(data, 201)
  })
}
