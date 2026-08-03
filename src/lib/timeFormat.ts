/** e.g. 45 → "45 minutes", 75 → "1 hour 15 minutes" */
export function formatDurationMinutes(minutes: number | string | null | undefined): string {
  const n = Math.round(Number(minutes ?? 0))
  if (!Number.isFinite(n) || n <= 0) return ''
  const h = Math.floor(n / 60)
  const m = n % 60
  if (h === 0) return m === 1 ? '1 minute' : `${m} minutes`
  const hourPart = h === 1 ? '1 hour' : `${h} hours`
  if (m === 0) return hourPart
  const minPart = m === 1 ? '1 minute' : `${m} minutes`
  return `${hourPart} ${minPart}`
}

/** Compact duration for tables — e.g. 3 → "3m", 303 → "5h 3m" */
export function formatDurationMinutesShort(minutes: number | string | null | undefined): string {
  const n = Math.round(Number(minutes ?? 0))
  if (!Number.isFinite(n) || n <= 0) return ''
  const h = Math.floor(n / 60)
  const m = n % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** e.g. "15:00" → "3:00 PM", ISO datetime → localized time */
export function formatClockTime(value: string | null | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (match) {
    const d = new Date()
    d.setHours(parseInt(match[1], 10), parseInt(match[2], 10), 0, 0)
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
  const d = new Date(normalized)
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Manila',
    })
  }
  return trimmed
}

/** Manila YYYY-MM-DD for a clock instant. */
export function workDateManila(value: string | null | undefined): string {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(value.includes('T') ? value : value.replace(' ', 'T')))
  } catch {
    return String(value).slice(0, 10)
  }
}

/** Clock-out time; appends (+1) when it falls on the next Manila day after clock-in. */
export function formatClockOutTime(
  clockIn: string | null | undefined,
  clockOut: string | null | undefined,
): string {
  if (!clockOut) return '—'
  const time = formatClockTime(clockOut) || '—'
  const inDay = workDateManila(clockIn)
  const outDay = workDateManila(clockOut)
  if (inDay && outDay && outDay > inDay) return `${time} (+1)`
  return time
}

/** e.g. "15:00–00:00" → "3:00 PM–12:00 AM" */
export function formatShiftTimeRange(label: string | null | undefined): string {
  if (!label) return ''
  const parts = label.split(/[–-]/)
  if (parts.length === 2) {
    return `${formatClockTime(parts[0].trim())}–${formatClockTime(parts[1].trim())}`
  }
  return formatClockTime(label)
}
