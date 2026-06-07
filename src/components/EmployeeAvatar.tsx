import { mediaUrl } from '../lib/media'

type Props = {
  photoUrl?: string | null
  firstName?: string
  lastName?: string
  size?: number
  className?: string
}

export function EmployeeAvatar({ photoUrl, firstName, lastName, size = 48, className }: Props) {
  const src = mediaUrl(photoUrl)
  const initials = `${(firstName?.[0] ?? '').toUpperCase()}${(lastName?.[0] ?? '').toUpperCase()}` || '?'

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`employee-avatar${className ? ` ${className}` : ''}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <span
      className={`employee-avatar employee-avatar--initials${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden
    >
      {initials}
    </span>
  )
}
