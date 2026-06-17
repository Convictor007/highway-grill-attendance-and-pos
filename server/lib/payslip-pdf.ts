import { payslipHtml } from './payslip-renderer'

async function launchBrowser() {
  if (process.env.VERCEL) {
    const chromium = await import('@sparticuz/chromium-min')
    const puppeteer = await import('puppeteer-core')
    return puppeteer.default.launch({
      args: chromium.default.args,
      defaultViewport: chromium.default.defaultViewport,
      executablePath: await chromium.default.executablePath(),
      headless: chromium.default.headless,
    })
  }

  try {
    const puppeteer = await import('puppeteer')
    return puppeteer.default.launch({ headless: true })
  } catch {
    const puppeteer = await import('puppeteer-core')
    return puppeteer.default.launch({
      headless: true,
      channel: 'chrome',
    })
  }
}

export async function generatePayslipPdf(row: Record<string, unknown>): Promise<Buffer> {
  const html = payslipHtml(row, true)
  const browser = await launchBrowser()
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
