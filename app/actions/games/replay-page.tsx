import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import { ReplayPlayer } from '../../assets/replay-player.tsx'
import type { Game } from '../../data/schema.ts'
import { getMode } from '../../game/modes.ts'
import { routes } from '../../routes.ts'
import { AppShell } from '../../ui/layout.tsx'
import type { Theme } from '../../ui/themes.ts'
import { formatTime } from '../../utils/format.ts'

export interface ReplayPageProps {
  game: Game
  username: string
  viewer?: { username: string } | null
  theme?: Theme
}

export function ReplayPage(handle: Handle<ReplayPageProps>) {
  return () => {
    let { game, username, viewer, theme } = handle.props
    let modeLabel = getMode(game.mode)?.label ?? game.mode
    return (
      <AppShell
        user={viewer}
        theme={theme}
        title={`${username}'s ${modeLabel} run · Retris`}
        description={`${username} cleared ${game.lines_cleared} lines in ${formatTime(game.duration_ms)} (${modeLabel}). Watch the full replay on Retris.`}
        canonical={routes.games.show.href({ id: String(game.id) })}
      >
        <div mix={headStyle}>
          <div>
            <h1 mix={titleStyle}>{formatTime(game.duration_ms)}</h1>
            <p mix={subStyle}>
              {username} · {modeLabel} · {game.lines_cleared} lines
            </p>
          </div>
        </div>
        <ReplayPlayer seed={game.seed} mode={game.mode} actionsJson={game.actions} />
      </AppShell>
    )
  }
}

const headStyle = css({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  marginBottom: '20px',
})
const titleStyle = css({
  margin: 0,
  fontSize: '28px',
  fontFamily: 'var(--font-display, var(--font))',
  fontVariantNumeric: 'tabular-nums',
})
const subStyle = css({ margin: '6px 0 0', color: 'var(--muted, #8b949e)' })
