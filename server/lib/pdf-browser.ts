import { config } from './env'

type PdfOptions = {
  format?: string
  landscape?: boolean
  printBackground?: boolean
  margin?: { top?: string; right?: string; bottom?: string; left?: string }
}

type PdfPage = {
  setContent: (html: string, options?: { waitUntil?: string }) => Promise<unknown>
  pdf: (options?: PdfOptions) => Promise<Uint8Array>
}

type LaunchedBrowser = {
  newPage: () => Promise<PdfPage>
  close: () => Promise<void>
}

/**
 * Launch a headless browser for PDF generation.
 *
 * On Vercel we use @sparticuz/chromium-min, which ships WITHOUT the Chromium
 * binary to keep the deployment small. The binary must be downloaded at runtime
 * from a hosted pack URL (config.chromiumPackUrl) that matches the installed
 * chromium-min version. Passing no URL makes executablePath() look for a local
 * bundled binary that does not exist, which fails with:
 *   "The input directory '/var/task/.../@sparticuz/chromium-min/bin' does not exist."
 */
export async function launchPdfBrowser(): Promise<LaunchedBrowser> {
  if (process.env.VERCEL) {
    const chromium = await import('@sparticuz/chromium-min')
    const puppeteer = await import('puppeteer-core')
    const executablePath = await chromium.default.executablePath(config.chromiumPackUrl)
    return (await puppeteer.default.launch({
      args: chromium.default.args,
      defaultViewport: chromium.default.defaultViewport,
      executablePath,
      headless: chromium.default.headless,
    })) as unknown as LaunchedBrowser
  }

  try {
    const puppeteer = await import('puppeteer')
    return (await puppeteer.default.launch({ headless: true })) as unknown as LaunchedBrowser
  } catch {
    const puppeteer = await import('puppeteer-core')
    return (await puppeteer.default.launch({
      headless: true,
      channel: 'chrome',
    })) as unknown as LaunchedBrowser
  }
}
