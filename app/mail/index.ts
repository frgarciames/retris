import { createMailSender } from "./create-sender.ts";
import { clearSentMails, sentMails } from "./senders/memory.ts";
import { passwordResetEmail } from "./templates.ts";
import type { MailMessage } from "./types.ts";

export type { MailMessage, MailSender } from "./types.ts";
export { clearSentMails, sentMails };

let sender = createMailSender();

// Test helper: swap the active sender (e.g. to assert on a custom implementation).
export function setMailSender(next: ReturnType<typeof createMailSender>): void {
  sender = next;
}

export function resetMailSender(): void {
  sender = createMailSender();
}

export async function sendMail(message: MailMessage): Promise<void> {
  await sender.send(message);
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  let { subject, html } = passwordResetEmail(token);
  await sendMail({ to, subject, html });
}
