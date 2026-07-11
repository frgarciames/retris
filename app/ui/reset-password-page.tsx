import type { Handle } from "remix/ui";
import { css } from "remix/ui";

import { routes } from "../routes.ts";
import { AppShell } from "./layout.tsx";
import type { Theme } from "./themes.ts";

export interface ResetPasswordPageProps {
  token: string;
  error?: string;
  invalid?: boolean;
  theme?: Theme;
}

export function ResetPasswordPage(handle: Handle<ResetPasswordPageProps>) {
  return () => {
    let { token, error, invalid, theme } = handle.props;

    return (
      <AppShell theme={theme} title="Reset password · Retris" noindex>
        <div mix={wrapStyle}>
          <h1 mix={headingStyle}>Reset password</h1>
          {invalid ? (
            <>
              <p mix={errorStyle}>This reset link is invalid or has expired.</p>
              <p mix={switchStyle}>
                <a href={routes.auth.forgotPassword.index.href()}>Request a new link</a>
              </p>
            </>
          ) : (
            <form
              method="post"
              action={routes.auth.resetPassword.action.href({ token })}
              mix={formStyle}
            >
              {error ? (
                <p role="alert" mix={errorStyle}>
                  {error}
                </p>
              ) : null}
              <p mix={introStyle}>Choose a new password for your account.</p>
              <label mix={labelStyle}>
                <span>New password</span>
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  required
                  minLength={6}
                  mix={inputStyle}
                />
              </label>
              <button type="submit" mix={submitStyle}>
                Update password
              </button>
            </form>
          )}
          <p mix={switchStyle}>
            <a href={routes.auth.login.index.href()}>Back to log in</a>
          </p>
        </div>
      </AppShell>
    );
  };
}

const wrapStyle = css({
  maxWidth: "380px",
  margin: "24px auto",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
});

const headingStyle = css({ margin: 0, fontSize: "22px" });
const introStyle = css({ margin: 0, color: "var(--muted)", fontSize: "14px" });

const formStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  padding: "24px",
  background: "var(--panel)",
  border: "var(--border-w, 1px) solid var(--border)",
  borderRadius: "var(--radius-lg, 12px)",
  boxShadow: "var(--shadow-panel, none)",
});

const labelStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  fontSize: "13px",
  color: "var(--muted)",
});

const inputStyle = css({
  appearance: "none",
  font: "inherit",
  color: "var(--text)",
  background: "var(--bg)",
  border: "var(--border-w, 1px) solid var(--border)",
  borderRadius: "var(--radius-sm, 8px)",
  padding: "10px 12px",
  "&:focus": { outline: "none", borderColor: "var(--accent)" },
});

const submitStyle = css({
  appearance: "none",
  font: "inherit",
  fontWeight: 700,
  cursor: "pointer",
  border: 0,
  borderRadius: "var(--radius-sm, 8px)",
  padding: "11px 14px",
  marginTop: "4px",
  background: "var(--accent)",
  color: "var(--accent-ink, #04121d)",
  boxShadow: "var(--glow, none)",
});

const errorStyle = css({
  margin: 0,
  padding: "10px 12px",
  borderRadius: "8px",
  background: "rgba(255,81,72,0.12)",
  border: "1px solid rgba(255,81,72,0.4)",
  color: "#ff8a84",
  fontSize: "13px",
});

const switchStyle = css({
  margin: 0,
  textAlign: "center",
  color: "var(--muted)",
  "& a": { color: "var(--accent)", textDecoration: "none" },
});
