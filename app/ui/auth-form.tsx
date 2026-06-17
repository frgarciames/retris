import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import { routes } from '../routes.ts'
import { AppShell } from './layout.tsx'
import type { Theme } from './themes.ts'

export interface AuthFormProps {
  mode: 'login' | 'signup'
  error?: string
  username?: string
  returnTo?: string
  theme?: Theme
}

export function AuthPage(handle: Handle<AuthFormProps>) {
  return () => {
    let { mode, error, username = '', returnTo, theme } = handle.props
    let isLogin = mode === 'login'
    let action = isLogin ? routes.auth.login.action.href() : routes.auth.signup.action.href()
    let title = isLogin ? 'Log in' : 'Sign up'

    return (
      <AppShell theme={theme} title={`${title} · Retris`} noindex>
        <div mix={wrapStyle}>
          <h1 mix={headingStyle}>{title}</h1>
          <form method="post" action={action} mix={formStyle}>
            {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
            {error ? (
              <p role="alert" mix={errorStyle}>
                {error}
              </p>
            ) : null}
            <label mix={labelStyle}>
              <span>Username</span>
              <input
                name="username"
                value={username}
                autoComplete="username"
                autoFocus
                required
                minLength={3}
                maxLength={20}
                mix={inputStyle}
              />
            </label>
            <label mix={labelStyle}>
              <span>Password</span>
              <input
                name="password"
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
                minLength={6}
                mix={inputStyle}
              />
            </label>
            <button type="submit" mix={submitStyle}>
              {title}
            </button>
          </form>
          <p mix={switchStyle}>
            {isLogin ? (
              <>
                No account? <a href={routes.auth.signup.index.href()}>Sign up</a>
              </>
            ) : (
              <>
                Already have an account? <a href={routes.auth.login.index.href()}>Log in</a>
              </>
            )}
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

const switchStyle = css({
  margin: 0,
  textAlign: 'center',
  color: 'var(--muted)',
  '& a': { color: 'var(--accent)', textDecoration: 'none' },
})
