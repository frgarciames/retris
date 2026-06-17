import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import { VersusBoard } from '../assets/versus-board.tsx'
import { routes } from '../routes.ts'
import { AppShell, type ShellUser } from './layout.tsx'
import type { Theme } from './themes.ts'

export interface VersusPageProps {
  user?: ShellUser | null
  theme?: Theme
  mode: string
}

export function VersusPage(handle: Handle<VersusPageProps>) {
  return () => {
    let { user, theme, mode } = handle.props
    return (
      <AppShell
        user={user}
        theme={theme}
        title="1vs1 · Retris"
        description="Play live 1v1 Retris. Every line you clear drops a garbage row on your opponent — first to 40 lines, or the last board standing, wins. Free and instant in your browser."
        canonical={routes.versus.index.href()}
      >
        <h1 mix={titleStyle}>1vs1</h1>
        <p mix={subtitleStyle}>
          Every line you clear drops a gray row on your opponent. First to 40 lines — or the last
          board standing — wins.
        </p>
        <VersusBoard
          mode={mode}
          eventsHref={routes.versus.events.href()}
          updateHref={routes.versus.update.href()}
        />
      </AppShell>
    )
  }
}

const titleStyle = css({
  margin: '0 0 8px',
  fontSize: '20px',
  textAlign: 'center',
  fontFamily: 'var(--font-display, var(--font))',
  letterSpacing: 'var(--tracking, 0.04em)',
})
const subtitleStyle = css({
  margin: '0 auto 24px',
  maxWidth: '440px',
  textAlign: 'center',
  fontSize: '13px',
  color: 'var(--muted, #8b949e)',
  '@media (max-width: 640px)': { display: 'none' },
})
