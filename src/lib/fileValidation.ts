export const PROFILE_PHOTO_ACCEPT = 'image/jpeg,image/png,.jpg,.jpeg,.png'
export const PROFILE_PHOTO_MAX_BYTES = 3 * 1024 * 1024

const PROFILE_PHOTO_EXTENSIONS = new Set(['jpg', 'jpeg', 'png'])
const PROFILE_PHOTO_MIMES = new Set(['image/jpeg', 'image/png'])

export type FileValidationResult = { ok: true } | { ok: false; message: string }

export function validateProfilePhoto(file: File): FileValidationResult {
  if (!file || file.size === 0) {
    return { ok: false, message: 'Photo file is required' }
  }
  if (file.size > PROFILE_PHOTO_MAX_BYTES) {
    return { ok: false, message: 'Photo too large (max 3 MB)' }
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!PROFILE_PHOTO_EXTENSIONS.has(ext)) {
    return { ok: false, message: 'Profile photo must be JPG or PNG' }
  }

  if (file.type && !PROFILE_PHOTO_MIMES.has(file.type)) {
    return { ok: false, message: 'Profile photo must be JPG or PNG' }
  }

  return { ok: true }
}
