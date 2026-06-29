import { launchPdfBrowser } from './pdf-browser'
import { payslipHtml } from './payslip-renderer'

export async function generatePayslipPdf(row: Record<string, unknown>): Promise<Buffer> {
  const html = payslipHtml(row, true)
  const browser = await launchPdfBrowser()
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12px', right: '12px', bottom: '12px', left: '12px' },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
