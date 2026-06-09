import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useNotification } from '../hooks/useNotification'
import { LoadingBlock } from './LoadingBlock'
import { Modal } from './Modal'
import { PayslipTemplate } from './PayslipTemplate'
import type { Payslip } from '../types/hrms'

type Props = {
  open: boolean
  payslipId: string | null
  onClose: () => void
}

export function PayslipDetailModal({ open, payslipId, onClose }: Props) {
  const { error: notifyError } = useNotification()
  const [detail, setDetail] = useState<Payslip | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !payslipId) {
      setDetail(null)
      return
    }

    setLoading(true)
    api<Payslip>(`/payroll/${payslipId}`)
      .then(setDetail)
      .catch((err) => {
        setDetail(null)
        notifyError(err instanceof Error ? err.message : 'Could not load payslip')
      })
      .finally(() => setLoading(false))
  }, [open, payslipId])

  return (
    <Modal
      open={open}
      title="Payslip"
      onClose={onClose}
      size="wide"
      panelClassName="payslip-modal-panel"
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost payslip-no-print"
            onClick={() => window.print()}
            disabled={!detail}
          >
            Print
          </button>
          <button type="button" className="btn btn-ghost payslip-no-print" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      {loading && <LoadingBlock label="Loading payslip…" />}
      {detail && !loading && <PayslipTemplate payslip={detail} />}
    </Modal>
  )
}
