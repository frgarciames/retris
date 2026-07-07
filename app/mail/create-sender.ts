import { createMemorySender } from './senders/memory.ts'
import { createNoopSender } from './senders/noop.ts'
import { createResendSender } from './senders/resend.ts'
import type { MailSender } from './types.ts'

const DEFAULT_FROM = 'noreply@retris.world'

export function createMailSender(): MailSender {
  if (process.env.NODE_ENV === 'test') {
    return createMemorySender()
  }

  let apiKey = process.env.RESEND_API_KEY?.trim()
  if (apiKey) {
    return createResendSender({
      apiKey,
      defaultFrom: process.env.MAIL_FROM?.trim() || DEFAULT_FROM,
    })
  }

  return createNoopSender()
}
