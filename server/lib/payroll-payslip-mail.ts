/** Email/PDF payslip delivery — stub until SMTP + PDF renderer is ported. */
export async function sendRunPayslips(_runId: string, _actorUserId?: string | null) {
  return { sent: 0, skipped: 0, failed: 0, details: [] as Record<string, unknown>[] }
}

export async function sendPayslip(payslipId: string, _actorUserId?: string | null) {
  return {
    payslip_id: payslipId,
    status: 'skipped',
    reason: 'Email delivery not configured on this server',
    skipped: true,
  }
}
