import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { env } from './env'
import { ValidationError } from './errors'

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

  const blobToken = env('BLOB_READ_WRITE_TOKEN')
  if (blobToken) {
    const { put } = await import('@vercel/blob')
    const blob = await put(`photos/${filename}`, buffer, {
      access: 'public',
      token: blobToken,
      contentType: file.type || `image/${normalizedExt}`,
    })
    return blob.url
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'photos')
  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, filename), buffer)
  return `/uploads/photos/${filename}`
}
