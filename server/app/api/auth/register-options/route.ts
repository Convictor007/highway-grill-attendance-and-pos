import { registerOptions } from '@/lib/registration'
import { jsonOk } from '@/lib/api-response'
import { handleRoute } from '@/lib/route-handler'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const branchId = new URL(request.url).searchParams.get('branch_id')
    return jsonOk(await registerOptions(branchId))
  })
}
