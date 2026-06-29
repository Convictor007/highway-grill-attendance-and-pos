import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { env } from './env'

export type StorageFolder = 'photos' | 'documents' | 'payslips'

/** Save a file to Vercel Blob (production) or server/public/uploads (local). */
export async function savePublicFile(
  folder: StorageFolder,
  filename: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const blobToken = env('BLOB_READ_WRITE_TOKEN')
  if (blobToken) {
    const { put } = await import('@vercel/blob')
    const blob = await put(`${folder}/${filename}`, buffer, {
      access: 'public',
      token: blobToken,
      contentType,
      // Filenames are deterministic (e.g. payslip-<id>.pdf, employee photos), so
      // re-saving should replace the existing blob instead of failing with
      // "This blob already exists" when a payslip is regenerated or re-emailed.
      allowOverwrite: true,
    })
    return blob.url
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder)
  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, filename), buffer)
  return `/uploads/${folder}/${filename}`
}

export function usesBlobStorage(): boolean {
  return Boolean(env('BLOB_READ_WRITE_TOKEN')?.trim())
}
