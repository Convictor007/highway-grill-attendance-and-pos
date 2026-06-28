import type { ReactNode } from 'react'
import hgLogo from '../assets/HG_logo.png'
import { buildPayslipTemplateData, formatMoney } from '../lib/payslipTemplate'
import type { Payslip } from '../types/hrms'

type Props = {
  payslip: Payslip
  companyName?: string
}

type KvRow = {
  label: string
  value: ReactNode
  dotted?: boolean
  sub?: boolean
  strong?: boolean
}

function AmountCell({ value }: { value: number }) {
  return <span className="payslip-tpl-amt">{formatMoney(value)}</span>
}

function DottedCell({ value }: { value: number | string }) {
  const text = typeof value === 'number' ? formatMoney(value) : value
  return <span className="payslip-tpl-dotted">{text || '\u00a0'}</span>
}

function KvTable({ rows }: { rows: KvRow[] }) {
  return (
    <table className="payslip-tpl-kv">
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.label}
            className={row.sub ? 'payslip-tpl-kv-row--sub' : row.strong ? 'payslip-tpl-kv-row--strong' : undefined}
          >
            <td className="payslip-tpl-kv-label">{row.label}</td>
            <td className={`payslip-tpl-kv-value${row.dotted ? ' payslip-tpl-kv-value--dotted' : ''}`}>
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function PayslipTemplate({ payslip, companyName = 'Highway Grill' }: Props) {
  const d = buildPayslipTemplateData(payslip, companyName)

  const midRows: KvRow[] = [
    { label: 'TARDINESS', value: <AmountCell value={d.tardiness} /> },
    { label: 'OUTSTANDING LOAN', value: <AmountCell value={d.outstandingLoan} /> },
    { label: 'CA', value: <DottedCell value={d.ca || ''} />, dotted: true },
    { label: 'HSNG', value: <DottedCell value={d.hsng || ''} />, dotted: true },
  ]

  const summaryRows: KvRow[] = [
    { label: 'EVENT Duty:', value: <AmountCell value={d.eventDuty} /> },
    { label: 'ALLOWANCE :', value: <AmountCell value={d.allowance} /> },
    { label: 'GROSS PAY:', value: <AmountCell value={d.grossPay} />, strong: true },
  ]

  // Total of everything itemised in the middle DEDUCTION column. Derived from
  // gross − net so it always reconciles with NET PAY. Avoids re-listing CA / loan
  // / HSNG (which already appear under DEDUCTION) twice on the slip.
  const totalDeductions = Math.max(0, Math.round((d.grossPay - d.netPay) * 100) / 100)
  const lessRows: KvRow[] = [
    { label: 'TOTAL DEDUCTIONS', value: <AmountCell value={totalDeductions} />, sub: true },
  ]

  return (
    <article className="payslip-tpl payslip-tpl--hg" aria-label={`Payslip for ${d.employeeName}`}>
      <div className="payslip-tpl-watermark" aria-hidden="true">
        <img src={hgLogo} alt="" />
      </div>

      <header className="payslip-tpl-brand">
        <p className="payslip-tpl-company-name">{d.companyName}</p>
        <div className="payslip-tpl-title-block">
          <div className="payslip-tpl-banner-wrap">
            <span className="payslip-tpl-banner">{d.title}</span>
          </div>
          <p className="payslip-tpl-period">
            PERIOD : <strong>{d.periodLabel}</strong>
          </p>
        </div>
      </header>

      <table className="payslip-tpl-top-table">
        <thead>
          <tr>
            <th className="payslip-tpl-top-head">BASIC PAY</th>
            <th className="payslip-tpl-top-head">OVERTIME</th>
            <th className="payslip-tpl-top-head payslip-tpl-top-head--total">TOTAL EARNINGS</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="payslip-tpl-top-value">
              <AmountCell value={d.basicPay} />
            </td>
            <td className="payslip-tpl-top-value">
              <AmountCell value={d.overtime} />
            </td>
            <td className="payslip-tpl-top-value payslip-tpl-top-total">
              <AmountCell value={d.earningsSubtotal} />
            </td>
          </tr>
        </tbody>
      </table>

      <table className="payslip-tpl-emp-table">
        <tbody>
          <tr>
            <td>
              <strong>EMPLOYEE:</strong> {d.employeeName}
            </td>
            <td>
              <strong>STATUS:</strong> {d.status}
            </td>
            <td>
              <strong>POSITION:</strong> {d.position}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="payslip-tpl-main-grid">
        <tbody>
          <tr>
            <td className="payslip-tpl-main-col payslip-tpl-main-col--earn">
              <table className="payslip-tpl-table">
                <thead>
                  <tr>
                    <th />
                    <th>Days</th>
                    <th>BASE PAY</th>
                    <th>ADJUSTMENTS</th>
                    <th>AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>{d.workType}</strong>
                    </td>
                    <td className="payslip-tpl-td-center">{d.days}</td>
                    <td className="payslip-tpl-td-num">{formatMoney(d.basePayRate)}</td>
                    <td className="payslip-tpl-td-center">{d.adjustmentsLabel}</td>
                    <td className="payslip-tpl-td-num payslip-tpl-td-dotted">
                      <DottedCell value={d.adjustmentsAmount > 0 ? d.adjustmentsAmount : ''} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>

            <td className="payslip-tpl-main-col payslip-tpl-main-col--ded">
              <table className="payslip-tpl-table payslip-tpl-table--ded">
                <thead>
                  <tr>
                    <th>DEDUCTION</th>
                    <th>AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>W/H TAX</td>
                    <td className="payslip-tpl-td-num">
                      <AmountCell value={d.deductions.whTax} />
                    </td>
                  </tr>
                  <tr>
                    <td>SSS</td>
                    <td className="payslip-tpl-td-num">
                      <DottedCell value={d.deductions.sss || ''} />
                    </td>
                  </tr>
                  <tr>
                    <td>SSS loan</td>
                    <td className="payslip-tpl-td-num">
                      <DottedCell value={d.deductions.sssLoan || ''} />
                    </td>
                  </tr>
                  <tr>
                    <td>PHILHEALTH</td>
                    <td className="payslip-tpl-td-num">
                      <DottedCell value={d.deductions.philhealth || ''} />
                    </td>
                  </tr>
                  <tr>
                    <td>HDMF</td>
                    <td className="payslip-tpl-td-num">
                      <DottedCell value={d.deductions.hdmf || ''} />
                    </td>
                  </tr>
                </tbody>
              </table>
              <KvTable rows={midRows} />
            </td>

            <td className="payslip-tpl-main-col payslip-tpl-main-col--summary">
              <KvTable rows={summaryRows} />
              <p className="payslip-tpl-hg-less-head">LESS:</p>
              <KvTable rows={lessRows} />
            </td>
          </tr>
        </tbody>
      </table>

      <div className="payslip-tpl-net">
        <div className="payslip-tpl-net-left">
          <strong>NET PAY :</strong>
          <span className="payslip-tpl-net-amount">{formatMoney(d.netPay)}</span>
        </div>
      </div>

      <div className="payslip-tpl-footer payslip-tpl-footer--hg">
        <div className="payslip-tpl-received">
          <strong>RECEIVED BY:</strong>
          <div className="payslip-tpl-sign-line" />
        </div>
      </div>
    </article>
  )
}
