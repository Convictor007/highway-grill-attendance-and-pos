import { ValidationError } from './errors'
import { savePublicFile } from './storage'

const ALLOWED = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])
const MAX_BYTES = 3 * 1024 * 1024

export async function saveEmployeePhoto(employeeId: string, file: File): Promise<string> {
  if (!file || file.size === 0) throw new ValidationError('photo file is required')
  if (file.size > MAX_BYTES) throw new ValidationError('Photo too large (max 3 MB)')

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED.has(ext)) throw new ValidationError('Photo must be JPG, PNG, WebP, or GIF')

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
