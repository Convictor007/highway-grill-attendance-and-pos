import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonOk } from '@/lib/api-response'
import { setEmployeePhotoUrl } from '@/lib/employees'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { saveEmployeePhoto } from '@/lib/photos'
import { handleRoute } from '@/lib/route-handler'

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'profile.edit.self')
    if (!user.employee_id) throw new NotFoundError('No employee profile linked')

    const form = await request.formData()
    const file = form.get('photo')
    if (!(file instanceof File)) {
      throw new ValidationError('photo file is required')
    }

    const url = await saveEmployeePhoto(user.employee_id, file)
    return jsonOk(await setEmployeePhotoUrl(user.employee_id, url))
  })
}
