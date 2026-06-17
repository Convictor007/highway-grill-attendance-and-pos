function pack(y: number, m: number, startDay: number, endDay: number, payDay: number, cutoff: string) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    period_start: `${y}-${pad(m)}-${pad(startDay)}`,
    period_end: `${y}-${pad(m)}-${pad(endDay)}`,
    pay_date: `${y}-${pad(m)}-${pad(payDay)}`,
    cutoff,
    pay_frequency: 'semi_monthly',
  }
}

export function currentSemiMonthly(asOf?: string) {
  const ts = asOf ? new Date(asOf + 'T12:00:00') : new Date()
  const y = ts.getFullYear()
  const m = ts.getMonth() + 1
  const d = ts.getDate()
  if (d <= 15) return pack(y, m, 1, 15, 15, 'first')
  const last = new Date(y, m, 0).getDate()
  return pack(y, m, 16, last, last, 'second')
}

export function nextSemiMonthly(asOf?: string) {
  const current = currentSemiMonthly(asOf)
  if (current.cutoff === 'first') {
    const y = Number(current.period_start.slice(0, 4))
    const m = Number(current.period_start.slice(5, 7))
    const last = new Date(y, m, 0).getDate()
    return pack(y, m, 16, last, last, 'second')
  }
  const next = new Date(current.period_start + 'T12:00:00')
  next.setMonth(next.getMonth() + 1)
  return pack(next.getFullYear(), next.getMonth() + 1, 1, 15, 15, 'first')
}

export function suggested(which = 'current') {
  return which === 'next' ? nextSemiMonthly() : currentSemiMonthly()
}
