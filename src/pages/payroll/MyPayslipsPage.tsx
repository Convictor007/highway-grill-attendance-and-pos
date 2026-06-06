import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmptyState } from '../../components/EmptyState'
import { PayslipDetailModal } from '../../components/PayslipDetailModal'

interface MyPayslip {
  id: string
  period_start: string
  period_end: string
  pay_date: string
  regular_hours: string
  gross_pay: string
  net_pay: string
  run_status: string
}

export function MyPayslipsPage() {
  const [rows, setRows] = useState<MyPayslip[]>([])
  const [loading, setLoading] = useState(true)
  const [detailId, setDetailId] = useState<string | null>(null)

  useEffect(() => {
    api<MyPayslip[]>('/payroll/my-payslips')
      .then(setRows)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader title="My Payroll" subtitle="Payslips and pay history" />
      <div className="card table-wrap">
        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState title="No payslips yet" description="Payslips appear after HR runs payroll." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Pay date</th>
                <th>Period</th>
                <th>Hours</th>
                <th>Gross</th>
                <th>Net</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className="row-clickable"
                  onClick={() => setDetailId(p.id)}
                >
                  <td>{p.pay_date}</td>
                  <td>{p.period_start} – {p.period_end}</td>
                  <td>{p.regular_hours}</td>
                  <td>{p.gross_pay}</td>
                  <td><strong>{p.net_pay}</strong></td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDetailId(p.id)
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PayslipDetailModal
        open={detailId != null}
        payslipId={detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  )
}
