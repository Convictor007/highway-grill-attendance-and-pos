import nodemailer from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import { config } from './env'

export type MailAttachment = {
  filename: string
  content: Buffer
  contentType?: string
}

let lastError: string | null = null

export function mailLastError(): string | null {
  return lastError
}

function createTransport() {
  const host = config.smtpHost.trim()
  if (!host) {
    return nodemailer.createTransport({ sendmail: true } as SMTPTransport.Options)
  }

  const secure = config.smtpEncryption.toLowerCase() === 'ssl'
  return nodemailer.createTransport({
    host,
    port: config.smtpPort,
    secure,
    auth: config.smtpUser
      ? { user: config.smtpUser, pass: config.smtpPass }
      : undefined,
    requireTLS: config.smtpEncryption.toLowerCase() === 'tls',
  })
}

export async function sendMail(options: {
  to: string
  subject: string
  text: string
  html?: string
  attachments?: MailAttachment[]
}): Promise<boolean> {
  lastError = null
  const to = options.to.trim()
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    lastError = 'Invalid recipient email'
    return false
  }

  if (!config.mailEnabled) {
    lastError = 'MAIL_ENABLED is false in environment'
    console.log(`[HG mail skipped] To: ${to} | ${options.subject}`)
    return false
  }

  try {
    const transport = createTransport()
    await transport.sendMail({
      from: {
        name: config.mailFromName,
        address: config.mailFrom,
      },
      to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: (options.attachments ?? []).map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType ?? 'application/octet-stream',
      })),
    })
    return true
  } catch (err) {
    lastError = err instanceof Error ? err.message : 'Mail send failed'
    console.error('[HG mail error]', lastError)
    return false
  }
}
