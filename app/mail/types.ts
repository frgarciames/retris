export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface MailSender {
  send(message: MailMessage): Promise<void>;
}
