import { dtrHtml } from './dtr-renderer'
import type { DtrReport } from './dtr-report'

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

export async function generateDtrPdf(report: DtrReport): Promise<Buffer> {
  const html = dtrHtml(report)
  const browser = await launchBrowser()
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
