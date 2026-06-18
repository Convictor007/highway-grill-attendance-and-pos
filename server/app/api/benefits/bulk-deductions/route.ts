import { requireUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth-guard'
import { jsonError, jsonOk } from '@/lib/api-response'
import {
  bulkApplyMonthlyDeduction,
  bulkDeductionEligible,
  type BulkDeductionAgency,
} from '@/lib/government-benefits'
import { ValidationError } from '@/lib/errors'
import { handleRoute } from '@/lib/route-handler'

const AGENCIES = new Set<BulkDeductionAgency>(['sss', 'philhealth', 'pagibig', 'tax'])

function parseAgency(value: unknown): BulkDeductionAgency {
  const agency = String(value ?? '') as BulkDeductionAgency
  if (!AGENCIES.has(agency)) throw new ValidationError('agency must be sss, philhealth, pagibig, or tax')
  return agency
}

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.manage')
    const url = new URL(request.url)
    const agency = parseAgency(url.searchParams.get('agency'))
    const branchId = url.searchParams.get('branch_id')
    return jsonOk(await bulkDeductionEligible(agency, branchId || null))
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    requirePermission(user, 'payroll.manage')
    const body = (await request.json()) as Record<string, unknown>
    const agency = parseAgency(body.agency)
    if (body.monthly_amount == null || body.monthly_amount === '') {
      return jsonError('monthly_amount required', 422)
    }
    const monthlyAmount = Number(body.monthly_amount)
    const branchId = body.branch_id ? String(body.branch_id) : null
    return jsonOk(await bulkApplyMonthlyDeduction(agency, monthlyAmount, branchId))
  })
}
