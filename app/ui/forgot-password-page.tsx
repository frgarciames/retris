import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import { routes } from '../routes.ts'
import { AppShell } from './layout.tsx'
import type { Theme } from './themes.ts'

export interface ForgotPasswordPageProps {
  error?: string
  sent?: boolean
  email?: string
  theme?: Theme
}

export function ForgotPasswordPage(handle: Handle<ForgotPasswordPageProps>) {
  return () => {
    let { error, sent, email = '', theme } = handle.props

    return (
      <AppShell theme={theme} title="Forgot password · Retris" noindex>
        <div mix={wrapStyle}>
          <h1 mix={headingStyle}>Forgot password</h1>
          {sent ? (
            <p mix={noticeStyle}>
              If an account exists for that email, we sent a reset link. Check your inbox.
            </p>
          ) : (
            <form method="post" action={routes.auth.forgotPassword.action.href()} mix={formStyle}>
              {error ? (
                <p role="alert" mix={errorStyle}>
                  {error}
                </p>
              ) : null}
              <p mix={introStyle}>Enter the email address for your account.</p>
              <label mix={labelStyle}>
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  value={email}
                  autoComplete="email"
                  autoFocus
                  required
                  mix={inputStyle}
                />
              </label>
              <button type="submit" mix={submitStyle}>
                Send reset link
              </button>
            </form>
          )}
          <p mix={switchStyle}>
            <a href={routes.auth.login.index.href()}>Back to log in</a>
          </p>
        </div>
      </AppShell>
    )
  }
}

const wrapStyle = css({
  maxWidth: '380px',
  margin: '24px auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
})

const headingStyle = css({ margin: 0, fontSize: '22px' })
const introStyle = css({ margin: 0, color: 'var(--muted)', fontSize: '14px' })

const formStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '24px',
  background: 'var(--panel)',
  border: 'var(--border-w, 1px) solid var(--border)',
  borderRadius: 'var(--radius-lg, 12px)',
  boxShadow: 'var(--shadow-panel, none)',
})

const labelStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontSize: '13px',
  color: 'var(--muted)',
})

const inputStyle = css({
  appearance: 'none',
  font: 'inherit',
  color: 'var(--text)',
  background: 'var(--bg)',
  border: 'var(--border-w, 1px) solid var(--border)',
  borderRadius: 'var(--radius-sm, 8px)',
  padding: '10px 12px',
  '&:focus': { outline: 'none', borderColor: 'var(--accent)' },
})

const submitStyle = css({
  appearance: 'none',
  font: 'inherit',
  fontWeight: 700,
  cursor: 'pointer',
  border: 0,
  borderRadius: 'var(--radius-sm, 8px)',
  padding: '11px 14px',
  marginTop: '4px',
  background: 'var(--accent)',
  color: 'var(--accent-ink, #04121d)',
  boxShadow: 'var(--glow, none)',
})

const errorStyle = css({
  margin: 0,
  padding: '10px 12px',
  borderRadius: '8px',
  background: 'rgba(255,81,72,0.12)',
  border: '1px solid rgba(255,81,72,0.4)',
  color: '#ff8a84',
  fontSize: '13px',
})

const noticeStyle = css({
  margin: 0,
  padding: '16px',
  borderRadius: 'var(--radius-lg, 12px)',
  background: 'var(--panel)',
  border: 'var(--border-w, 1px) solid var(--border)',
  color: 'var(--muted)',
  fontSize: '14px',
  lineHeight: 1.5,
})

const switchStyle = css({
  margin: 0,
  textAlign: 'center',
  color: 'var(--muted)',
  '& a': { color: 'var(--accent)', textDecoration: 'none' },
})
