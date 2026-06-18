import { ValidationError } from './errors'
import { validateProfilePhoto } from './file-validation'
import { savePublicFile } from './storage'

export async function saveEmployeePhoto(employeeId: string, file: File): Promise<string> {
  try {
    validateProfilePhoto(file)
  } catch (e) {
    throw new ValidationError(e instanceof Error ? e.message : 'Invalid photo')
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const normalizedExt = ext === 'jpeg' ? 'jpg' : ext
  const filename = `${employeeId}.${normalizedExt}`
  const buffer = Buffer.from(await file.arrayBuffer())

  return savePublicFile(
    'photos',
    filename,
    buffer,
    file.type || `image/${normalizedExt}`,
  )
}
