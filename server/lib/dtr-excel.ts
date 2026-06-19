import ExcelJS from 'exceljs'
import type { DtrReport } from './dtr-report'

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export async function generateDtrExcel(report: DtrReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Highway Grill'
  const ws = wb.addWorksheet('DTR', { views: [{ state: 'frozen', ySplit: 5 }] })

  const emp = report.employee
  const name = `${emp.first_name} ${emp.last_name}`.trim()

  ws.mergeCells('A1:M1')
  ws.getCell('A1').value = 'Daily Time Record'
  ws.getCell('A1').font = { bold: true, size: 14 }

  ws.mergeCells('A2:M2')
  ws.getCell('A2').value = `${name} · ${emp.emp_number} · ${emp.position_title ?? ''} · ${emp.branch_name ?? ''}`

  ws.mergeCells('A3:M3')
  ws.getCell('A3').value = `${report.from} to ${report.to} (${report.timezone})`

  const headers = [
    'Date',
    'Status',
    'Shift',
    'Sched in',
    'Sched out',
    'Time in',
    'Time out',
    'Break start',
    'Break end',
    'Reg hrs',
    'Actual hrs',
    'OT hrs',
    'Late (min)',
    'Early out (min)',
    'Notes',
  ]
  const headerRow = ws.getRow(5)
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
    cell.font = { bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    }
  })

  let rowNum = 6
  for (const d of report.days) {
    const row = ws.getRow(rowNum)
    const values = [
      fmtDate(d.date),
      d.status_label,
      d.shift_name ?? '',
      d.scheduled_start ?? '',
      d.scheduled_end ?? '',
      d.clock_in ?? '',
      d.clock_out ?? '',
      d.break_start ?? '',
      d.break_end ?? '',
      d.regular_hours ?? '',
      d.actual_hours ?? '',
      d.overtime_hours ?? '',
      d.late_in_minutes ?? '',
      d.early_out_minutes ?? '',
      d.leave_type ?? d.remarks ?? '',
    ]
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1)
      cell.value = v
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }
    })
    rowNum += 1
  }

  rowNum += 1
  const t = report.totals
  const summaryLabels = [
    ['Days worked', t.days_worked],
    ['Absent', t.days_absent],
    ['Rest days', t.rest_days],
    ['On leave', t.leave_days],
    ['Regular hours', t.regular_hours],
    ['Actual hours', t.actual_hours],
    ['Overtime hours', t.overtime_hours],
  ]
  for (const [label, val] of summaryLabels) {
    const row = ws.getRow(rowNum)
    row.getCell(1).value = label
    row.getCell(1).font = { bold: true }
    row.getCell(2).value = val
    rowNum += 1
  }

  ws.columns = [
    { width: 22 },
    { width: 12 },
    { width: 14 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 9 },
    { width: 9 },
    { width: 8 },
    { width: 10 },
    { width: 12 },
    { width: 18 },
  ]

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
