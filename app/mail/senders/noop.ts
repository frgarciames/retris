import type { MailSender } from "../types.ts";

// Used when no outbound mail provider is configured (typical local dev).
export function createNoopSender(): MailSender {
  return {
    async send(message) {
      console.warn("Mail is not configured — message not sent:", message.subject, "to", message.to);
    },
  };
}
