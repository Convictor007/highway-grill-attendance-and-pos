export const PROFILE_PHOTO_MAX_BYTES = 3 * 1024 * 1024

const PROFILE_PHOTO_EXTENSIONS = new Set(['jpg', 'jpeg', 'png'])
const PROFILE_PHOTO_MIMES = new Set(['image/jpeg', 'image/png'])

export function validateProfilePhoto(file: File): void {
  if (!file || file.size === 0) {
    throw new Error('photo file is required')
  }
  if (file.size > PROFILE_PHOTO_MAX_BYTES) {
    throw new Error('Photo too large (max 3 MB)')
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!PROFILE_PHOTO_EXTENSIONS.has(ext)) {
    throw new Error('Profile photo must be JPG or PNG')
  }

  if (file.type && !PROFILE_PHOTO_MIMES.has(file.type)) {
    throw new Error('Profile photo must be JPG or PNG')
  }
}
