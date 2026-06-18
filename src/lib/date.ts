/** Normalize API/DB dates for date pickers (YYYY-MM-DD). */
export function toDateInputValue(value: string | null | undefined): string {
  if (value == null || value === '') return ''
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s.includes('T') ? s : `${s}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}
