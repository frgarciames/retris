import type { MailMessage, MailSender } from "../types.ts";

export interface ResendSenderOptions {
  apiKey: string;
  defaultFrom: string;
}

export function createResendSender(options: ResendSenderOptions): MailSender {
  return {
    async send(message: MailMessage) {
      let res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: message.from ?? options.defaultFrom,
          to: [message.to],
          subject: message.subject,
          html: message.html,
        }),
      });

      if (!res.ok) {
        let body = await res.text();
        throw new Error(`Resend API error ${res.status}: ${body}`);
      }
    },
  };
}
