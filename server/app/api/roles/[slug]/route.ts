import { getRoleBySlug } from '@/lib/roles'
import { jsonError, jsonOk } from '@/lib/api-response'
import { handleRoute } from '@/lib/route-handler'

type Params = { params: Promise<{ slug: string }> }

export async function GET(_request: Request, { params }: Params) {
  return handleRoute(async () => {
    const { slug } = await params
    const role = await getRoleBySlug(slug)
    if (!role) return jsonError('Role not found', 404)
    return jsonOk(role)
  })
}
