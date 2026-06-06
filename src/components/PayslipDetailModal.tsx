import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Modal } from './Modal'
import type { Payslip } from '../types/hrms'

type Props = {
  open: boolean
  payslipId: string | null
  onClose: () => void
}

function money(value: string | number | undefined | null) {
  if (value == null || value === '') return '—'
  return `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function hours(value: string | number | undefined | null) {
  if (value == null || value === '') return '—'
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="payslip-line">
      <span className="payslip-line-label">{label}</span>
      {strong ? <strong>{value}</strong> : <span>{value}</span>}
    </div>
  )
}

export function PayslipDetailModal({ open, payslipId, onClose }: Props) {
  const [detail, setDetail] = useState<Payslip | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !payslipId) {
      setDetail(null)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    api<Payslip>(`/payroll/${payslipId}`)
      .then(setDetail)
      .catch((err) => {
        setDetail(null)
        setError(err instanceof Error ? err.message : 'Could not load payslip')
      })
      .finally(() => setLoading(false))
  }, [open, payslipId])

  const employeeName =
    detail?.first_name || detail?.last_name
      ? `${detail.first_name ?? ''} ${detail.last_name ?? ''}`.trim()
      : null

  return (
    <Modal
      open={open}
      title={employeeName ? `Payslip — ${employeeName}` : 'Payslip detail'}
      onClose={onClose}
      size="wide"
      footer={
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      }
    >
      {loading && <p style={{ color: 'var(--muted)' }}>Loading payslip…</p>}
      {error && <p className="error-msg">{error}</p>}
      {detail && !loading && (
        <div className="payslip-detail">
          <div className="payslip-detail-meta">
            {detail.emp_number && <span>#{detail.emp_number}</span>}
            {detail.pay_date && <span>Pay date {detail.pay_date}</span>}
            {detail.period_start && detail.period_end && (
              <span>
                Period {detail.period_start} – {detail.period_end}
              </span>
            )}
            {detail.run_status && <span className={`badge badge-${detail.run_status}`}>{detail.run_status}</span>}
          </div>

          <div className="payslip-detail-grid">
            <section className="payslip-detail-section">
              <h3 className="section-title">Hours</h3>
              <Line label="Regular" value={hours(detail.regular_hours)} />
              <Line label="Overtime" value={hours(detail.overtime_hours)} />
              <Line label="Holiday" value={hours(detail.holiday_hours)} />
            </section>

            <section className="payslip-detail-section">
              <h3 className="section-title">Earnings</h3>
              <Line label="Basic pay" value={money(detail.basic_pay)} />
              <Line label="Overtime pay" value={money(detail.overtime_pay)} />
              <Line label="Tips" value={money(detail.tips_amount)} />
              <Line label="Service charge" value={money(detail.service_charge)} />
              <Line label="Gross pay" value={money(detail.gross_pay)} strong />
            </section>

            <section className="payslip-detail-section">
              <h3 className="section-title">Deductions</h3>
              <Line label="Withholding tax" value={money(detail.tax_amount)} />
              <Line label="SSS" value={money(detail.sss_amount)} />
              <Line label="PhilHealth" value={money(detail.philhealth_amount)} />
              <Line label="Pag-IBIG" value={money(detail.pagibig_amount)} />
              <Line label="Other deductions" value={money(detail.other_deductions)} />
            </section>
          </div>

          <div className="payslip-detail-net">
            <span>Net pay</span>
            <strong>{money(detail.net_pay)}</strong>
          </div>
        </div>
      )}
    </Modal>
  )
}
