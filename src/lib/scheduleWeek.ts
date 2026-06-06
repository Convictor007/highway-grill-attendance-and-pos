/** Sunday of the week containing `date` (YYYY-MM-DD). */
export function sundayOfWeek(date = new Date()): string {
  const d = new Date(date)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d.toISOString().slice(0, 10)
}

export function shiftWeek(start: string, deltaWeeks: number): string {
  const d = new Date(start + 'T12:00:00')
  d.setDate(d.getDate() + deltaWeeks * 7)
  return d.toISOString().slice(0, 10)
}

export function tomorrowWeekStart(): string {
  const t = new Date()
  t.setDate(t.getDate() + 1)
  return sundayOfWeek(t)
}
