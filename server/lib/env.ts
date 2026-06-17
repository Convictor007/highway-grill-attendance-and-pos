export function env(key: string, fallback = ''): string {
  return process.env[key]?.trim() ?? fallback
}

export function envInt(key: string, fallback: number): number {
  const raw = process.env[key]
  if (raw === undefined || raw === '') return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : fallback
}

export function envBool(key: string, fallback = false): boolean {
  const raw = process.env[key]
  if (raw === undefined || raw === '') return fallback
  return raw === 'true' || raw === '1'
}

function defaultCorsOrigin(): string {
  const explicit = process.env.CORS_ORIGIN?.trim()
  if (explicit) return explicit
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel}`
  return 'http://localhost:5173'
}

export const config = {
  corsOrigin: defaultCorsOrigin(),
  sessionTtlHours: envInt('SESSION_TTL_HOURS', 24),
  authHashPasswords: envBool('AUTH_HASH_PASSWORDS', false),
  hrNotifyEmail: env('HR_NOTIFY_EMAIL', ''),
  mailEnabled: envBool('MAIL_ENABLED', false),
  mailFrom: env('MAIL_FROM', 'noreply@highwaygrill.local'),
  mailFromName: env('MAIL_FROM_NAME', 'Highway Grill HR'),
  appUrl: env('APP_URL', 'http://localhost:5173'),
  smtpHost: env('SMTP_HOST', ''),
  smtpPort: envInt('SMTP_PORT', 587),
  smtpUser: env('SMTP_USER', ''),
  smtpPass: env('SMTP_PASS', ''),
  smtpEncryption: env('SMTP_ENCRYPTION', 'tls'),
}
