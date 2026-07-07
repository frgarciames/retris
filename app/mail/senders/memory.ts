import type { MailMessage, MailSender } from '../types.ts'

export let sentMails: MailMessage[] = []

export function clearSentMails(): void {
  sentMails = []
}

export function createMemorySender(): MailSender {
  return {
    async send(message) {
      sentMails.push(message)
    },
  }
}
