import type { DtrReport } from './dtr-report'

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtPeriod(from: string, to: string): string {
  const f = new Date(`${from}T12:00:00`)
  const t = new Date(`${to}T12:00:00`)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  return `${f.toLocaleDateString('en-PH', opts)} – ${t.toLocaleDateString('en-PH', opts)}`
}

function num(value: number | null | undefined): string {
  if (value == null || value === 0) return '—'
  return value.toFixed(2)
}

function mins(value: number | null | undefined): string {
  if (value == null || value <= 0) return '—'
  return `${value}m`
}

export function dtrHtml(report: DtrReport): string {
  const emp = report.employee
  const name = `${emp.first_name} ${emp.last_name}`.trim()
  const meta = [
    emp.emp_number ? `Emp # ${emp.emp_number}` : '',
    emp.position_title ?? '',
    emp.branch_name ?? '',
  ]
    .filter(Boolean)
    .join(' · ')

  const rows = report.days
    .map((d) => {
      const statusCls =
        d.status === 'absent' ? 'status-absent'
        : d.status === 'rest_day' ? 'status-rest'
        : d.status === 'on_leave' ? 'status-leave'
        : d.status === 'incomplete' ? 'status-incomplete'
        : ''
      return `<tr>
        <td>${esc(fmtDate(d.date))}</td>
        <td class="${statusCls}">${esc(d.status_label)}</td>
        <td>${esc(d.shift_name ?? '—')}</td>
        <td>${esc(d.scheduled_start ?? '—')}</td>
        <td>${esc(d.scheduled_end ?? '—')}</td>
        <td>${esc(d.clock_in ?? '—')}</td>
        <td>${esc(d.clock_out ?? '—')}</td>
        <td class="num">${num(d.regular_hours)}</td>
        <td class="num">${num(d.actual_hours)}</td>
        <td class="num">${num(d.overtime_hours)}</td>
        <td class="num">${mins(d.late_in_minutes)}</td>
        <td class="num">${mins(d.early_out_minutes)}</td>
        <td>${esc(d.leave_type ?? d.remarks ?? '—')}</td>
      </tr>`
    })
    .join('')

  const t = report.totals

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>DTR — ${esc(name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #1a1a1a; margin: 0; padding: 16px; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  .meta { color: #555; margin-bottom: 4px; }
  .period { font-size: 11px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 4px 5px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; font-weight: 600; font-size: 9px; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .status-absent { color: #b91c1c; font-weight: 600; }
  .status-rest { color: #6b7280; }
  .status-leave { color: #2563eb; }
  .status-incomplete { color: #d97706; }
  .totals { margin-top: 12px; display: flex; gap: 24px; flex-wrap: wrap; font-size: 10px; }
  .totals strong { display: block; font-size: 12px; }
  .foot { margin-top: 16px; font-size: 9px; color: #888; }
</style>
</head>
<body>
  <h1>Daily Time Record</h1>
  <div class="meta"><strong>${esc(name)}</strong>${meta ? ` — ${esc(meta)}` : ''}</div>
  <div class="period">${esc(fmtPeriod(report.from, report.to))} · ${esc(report.timezone)}</div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Status</th>
        <th>Shift</th>
        <th>Sched in</th>
        <th>Sched out</th>
        <th>Time in</th>
        <th>Time out</th>
        <th>Reg hrs</th>
        <th>Actual</th>
        <th>OT</th>
        <th>Late</th>
        <th>Early out</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div><span>Days worked</span><strong>${t.days_worked}</strong></div>
    <div><span>Absent</span><strong>${t.days_absent}</strong></div>
    <div><span>Rest days</span><strong>${t.rest_days}</strong></div>
    <div><span>On leave</span><strong>${t.leave_days}</strong></div>
    <div><span>Regular hours</span><strong>${t.regular_hours.toFixed(2)}</strong></div>
    <div><span>Actual hours</span><strong>${t.actual_hours.toFixed(2)}</strong></div>
    <div><span>Overtime</span><strong>${t.overtime_hours.toFixed(2)}</strong></div>
  </div>
  <div class="foot">Generated ${esc(new Date(report.generated_at).toLocaleString('en-PH'))} · Highway Grill</div>
</body>
</html>`
}
