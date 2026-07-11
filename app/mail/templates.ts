import { routes } from "../routes.ts";
import { siteUrl } from "../ui/seo.tsx";

export function passwordResetEmail(token: string): { subject: string; html: string } {
  let resetUrl = siteUrl(routes.auth.resetPassword.index.href({ token }));
  return {
    subject: "Reset your Retris password",
    html: `<!DOCTYPE html>
<html lang="en">
  <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
    <p>We received a request to reset your Retris password.</p>
    <p><a href="${resetUrl}">Reset your password</a></p>
    <p>This link expires in one hour. If you did not request a reset, you can ignore this email.</p>
  </body>
</html>`,
  };
}
