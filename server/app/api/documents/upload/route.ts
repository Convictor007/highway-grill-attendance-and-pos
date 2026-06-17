import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { upload } from '@/lib/documents'
import { handleRoute } from '@/lib/route-handler'

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'employees.manage')
    const form = await request.formData()
    const fields: Record<string, string> = {}
    for (const [key, value] of form.entries()) {
      if (typeof value === 'string') fields[key] = value
    }
    const file = form.get('file')
    const fileObj = file instanceof File ? file : null
    return jsonOk(await upload(fields, fileObj, user.id), 201)
  })
}
