import { launchPdfBrowser } from './pdf-browser'
import { dtrHtml } from './dtr-renderer'
import type { DtrReport } from './dtr-report'

export async function generateDtrPdf(report: DtrReport): Promise<Buffer> {
  const html = dtrHtml(report)
  const browser = await launchPdfBrowser()
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '12px', right: '12px', bottom: '12px', left: '12px' },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
