import { requireUser } from '@/lib/auth'
import { requireActiveEmployeeAccount, requirePermission } from '@/lib/auth-guard'
import { hasPermission } from '@/lib/permissions'
import { jsonError } from '@/lib/api-response'
import { buildDtrReport } from '@/lib/dtr-report'
import { generateDtrExcel } from '@/lib/dtr-excel'
import { generateDtrPdf } from '@/lib/dtr-pdf'
import { todayIso } from '@/lib/date-utils'
import { defaultHistoryFrom } from '@/lib/attendance'
import { ForbiddenError } from '@/lib/errors'
import { handleRoute } from '@/lib/route-handler'
import { checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80)
}

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    checkRateLimit(`dtr-export:${user.id}`, 15, 60 * 60 * 1000)

    const url = new URL(request.url)
    const format = (url.searchParams.get('format') ?? 'xlsx').toLowerCase()
    if (format !== 'xlsx' && format !== 'pdf') {
      return jsonError('format must be xlsx or pdf', 422)
    }

    const from = url.searchParams.get('from') ?? defaultHistoryFrom()
    const to = url.searchParams.get('to') ?? todayIso()

    let employeeId: string
    if (hasPermission(user, 'attendance.view')) {
      const eid = url.searchParams.get('employee_id')
      if (!eid) return jsonError('employee_id required', 422)
      employeeId = eid
    } else if (hasPermission(user, 'attendance.self') && user.employee_id) {
      requireActiveEmployeeAccount(user)
      employeeId = user.employee_id
    } else {
      throw new ForbiddenError()
    }

    const report = await buildDtrReport(employeeId, from, to)
    const base = `DTR_${report.employee.emp_number || report.employee.id}_${report.from}_${report.to}`

    if (format === 'pdf') {
      const pdf = await generateDtrPdf(report)
      return new Response(new Uint8Array(pdf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safeFilename(base)}.pdf"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const xlsx = await generateDtrExcel(report)
    return new Response(new Uint8Array(xlsx), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeFilename(base)}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  })
}
