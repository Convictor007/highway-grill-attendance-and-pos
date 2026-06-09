export type SemiMonthlyPeriod = {
  period_start: string
  period_end: string
  pay_date: string
  cutoff: 'first' | 'second'
  pay_frequency: 'semi_monthly'
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function pack(y: number, m: number, startDay: number, endDay: number, payDay: number, cutoff: 'first' | 'second'): SemiMonthlyPeriod {
  return {
    period_start: `${y}-${pad2(m)}-${pad2(startDay)}`,
    period_end: `${y}-${pad2(m)}-${pad2(endDay)}`,
    pay_date: `${y}-${pad2(m)}-${pad2(payDay)}`,
    cutoff,
    pay_frequency: 'semi_monthly',
  }
}

/** Current semi-monthly cutoff containing today. */
export function currentSemiMonthly(date = new Date()): SemiMonthlyPeriod {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  if (d <= 15) {
    return pack(y, m, 1, 15, 15, 'first')
  }
  const last = new Date(y, m, 0).getDate()
  return pack(y, m, 16, last, last, 'second')
}

export function nextSemiMonthly(date = new Date()): SemiMonthlyPeriod {
  const cur = currentSemiMonthly(date)
  if (cur.cutoff === 'first') {
    const y = Number(cur.period_start.slice(0, 4))
    const m = Number(cur.period_start.slice(5, 7))
    const last = new Date(y, m, 0).getDate()
    return pack(y, m, 16, last, last, 'second')
  }
  const next = new Date(`${cur.period_start}T12:00:00`)
  next.setMonth(next.getMonth() + 1)
  return pack(next.getFullYear(), next.getMonth() + 1, 1, 15, 15, 'first')
}

export function cutoffLabel(cutoff: 'first' | 'second'): string {
  return cutoff === 'first' ? '1st cutoff (1–15)' : '2nd cutoff (16–end)'
}
