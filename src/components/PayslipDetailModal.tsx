import { useEffect, useRef, useState } from 'react'
import { api, apiDownload, ApiError } from '../lib/api'
import { useNotification } from '../hooks/useNotification'
import { LoadingBlock } from './LoadingBlock'
import { Modal } from './Modal'

type Props = {
  open: boolean
  payslipId: string | null
  onClose: () => void
}

export function PayslipDetailModal({ open, payslipId, onClose }: Props) {
  const { error: notifyError } = useNotification()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    if (!payslipId) return
    setDownloading(true)
    try {
      await apiDownload(`/payroll/payslip/${payslipId}/pdf`, 'payslip.pdf')
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Could not download payslip')
    } finally {
      setDownloading(false)
    }
  }

  function handlePrint() {
    const frame = frameRef.current
    if (!frame?.contentWindow) return
    frame.contentWindow.focus()
    frame.contentWindow.print()
  }

  useEffect(() => {
    if (!open || !payslipId) {
      setHtml(null)
      return
    }

    setLoading(true)
    api<{ html: string }>(`/payroll/payslip/${payslipId}/html`)
      .then((data) => setHtml(data.html))
      .catch((err) => {
        setHtml(null)
        notifyError(err instanceof Error ? err.message : 'Could not load payslip')
      })
      .finally(() => setLoading(false))
  }, [open, payslipId, notifyError])

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
            onClick={handleDownload}
            disabled={!html || downloading}
          >
            {downloading ? 'Preparing…' : 'Download PDF'}
          </button>
          <button
            type="button"
            className="btn btn-ghost payslip-no-print"
            onClick={handlePrint}
            disabled={!html}
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
      {html && !loading && (
        <iframe
          ref={frameRef}
          className="payslip-html-frame"
          title="Payslip"
          srcDoc={html}
          sandbox="allow-same-origin allow-modals"
        />
      )}
    </Modal>
  )
}
