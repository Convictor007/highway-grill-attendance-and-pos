import { jsonError } from '@/lib/api-response'
import { handleRoute } from '@/lib/route-handler'

export async function PUT() {
  return handleRoute(async () => {
    return jsonError('Overtime from DTR is approved automatically. Manual review is no longer required.', 410)
  })
}
