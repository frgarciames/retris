import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { LeaderboardEntry } from '../data/games.ts'
import type { VersusDir, VersusSort, VersusStanding } from '../data/versus.ts'
import type { GameMode } from '../game/modes.ts'
import { rankingKind } from '../game/modes.ts'
import { routes } from '../routes.ts'
import { formatClassicScore, formatTime } from '../utils/format.ts'
import { AppShell, type ShellUser } from './layout.tsx'
import type { Theme } from './themes.ts'

export interface ModeBoard {
  mode: GameMode
  entries: LeaderboardEntry[]
}

export interface LeaderboardPageProps {
  user?: ShellUser | null
  theme?: Theme
  boards: ModeBoard[]
  versus: VersusStanding[]
  versusSort: VersusSort
  versusDir: VersusDir
}

// A clickable column header that ranks the 1v1 table by its column. The active
// sort is accent-coloured with a caret; clicking the active one toggles
// ?vdir=desc/asc while clicking the inactive one activates it in desc order.
function SortHeader(
  handle: Handle<{ label: string; sort: VersusSort; active: VersusSort; activeDir: VersusDir }>,
) {
  return () => {
    let { label, sort, active, activeDir } = handle.props
    let isActive = sort === active
    let nextDir: VersusDir = isActive && activeDir === 'desc' ? 'asc' : 'desc'
    return (
      <a
        href={`${routes.leaderboard.href()}?vsort=${sort}&vdir=${nextDir}`}
        mix={isActive ? [sortLinkStyle, sortActiveStyle] : sortLinkStyle}
        aria-sort={isActive ? (activeDir === 'desc' ? 'descending' : 'ascending') : 'none'}
      >
        {label}
        <span mix={caretStyle}>{isActive ? (activeDir === 'desc' ? '▼' : '▲') : ''}</span>
      </a>
    )
  }
}

export function LeaderboardPage(handle: Handle<LeaderboardPageProps>) {
  return () => {
    let { user, theme, boards, versus, versusSort, versusDir } = handle.props
    return (
      <AppShell
        user={user}
        theme={theme}
        title="Leaderboard · Retris"
        description="The fastest 20- and 40-line sprint times and the top 1v1 players in Retris, the free browser falling-blocks puzzle game."
        canonical={routes.leaderboard.href()}
      >
        <h1 mix={titleStyle}>Leaderboard</h1>

        <section mix={boardSectionStyle}>
          <h2 mix={boardHeading}>
            1vs1
            <a href={routes.versus.index.href()} mix={playModeStyle}>
              Play 1vs1
            </a>
          </h2>
          {versus.length === 0 ? (
            <p mix={emptyStyle}>No matches yet. Win a 1vs1 to claim the top spot.</p>
          ) : (
            <table mix={tableStyle}>
              <thead>
                <tr>
                  <th mix={thStyle}>#</th>
                  <th mix={thStyle}>Player</th>
                  <th mix={[thStyle, rightStyle]}>
                    <SortHeader label="Wins" sort="wins" active={versusSort} activeDir={versusDir} />
                  </th>
                  <th mix={[thStyle, rightStyle]}>
                    <SortHeader
                      label="Avg wins"
                      sort="avg"
                      active={versusSort}
                      activeDir={versusDir}
                    />
                  </th>
                  <th mix={[thStyle, rightStyle]}>Replay (last game)</th>
                </tr>
              </thead>
              <tbody>
                {versus.map((entry) => (
                  <tr key={entry.user_id} mix={rowStyle}>
                    <td mix={[tdStyle, rankStyle]}>{entry.rank}</td>
                    <td mix={tdStyle}>{entry.username}</td>
                    <td mix={[tdStyle, rightStyle, timeStyle]}>{entry.wins}</td>
                    <td mix={[tdStyle, rightStyle]}>{entry.winRate}%</td>
                    <td mix={[tdStyle, rightStyle]}>
                      <a
                        href={routes.versus.show.href({ id: String(entry.replayGameId) })}
                        mix={watchStyle}
                      >
                        Watch
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {boards.map(({ mode, entries }) => (
          <section key={mode.id} mix={boardSectionStyle}>
            <h2 mix={boardHeading}>
              {mode.label}
              <a href={`${routes.home.href()}?mode=${mode.id}`} mix={playModeStyle}>
                Play {mode.label}
              </a>
            </h2>
            {entries.length === 0 ? (
              <p mix={emptyStyle}>No runs yet. Be the first to set a time.</p>
            ) : (
              <table mix={tableStyle}>
                <thead>
                  <tr>
                    <th mix={thStyle}>#</th>
                    <th mix={thStyle}>Player</th>
                    <th mix={[thStyle, rightStyle]}>
                      {rankingKind(mode) === 'levelTime' ? 'Level / Time' : 'Time'}
                    </th>
                    <th mix={[thStyle, rightStyle]}>Replay</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.game.id} mix={rowStyle}>
                      <td mix={[tdStyle, rankStyle]}>{entry.rank}</td>
                      <td mix={tdStyle}>{entry.username}</td>
                      <td mix={[tdStyle, rightStyle, timeStyle]}>
                        {rankingKind(mode) === 'levelTime'
                          ? formatClassicScore(entry.game.level, entry.game.duration_ms)
                          : formatTime(entry.game.duration_ms)}
                      </td>
                      <td mix={[tdStyle, rightStyle]}>
                        <a href={routes.games.show.href({ id: String(entry.game.id) })} mix={watchStyle}>
                          Watch
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))}
      </AppShell>
    )
  }
}

const titleStyle = css({
  margin: '0 0 8px',
  fontSize: '24px',
  fontFamily: 'var(--font-display, var(--font))',
  letterSpacing: 'var(--tracking, 0.04em)',
})

const boardSectionStyle = css({ marginTop: '32px' })
const boardHeading = css({
  margin: '0 0 16px',
  fontSize: '13px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--muted, #8b949e)',
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '12px',
})
const playModeStyle = css({
  color: 'var(--accent, #2dacf9)',
  textDecoration: 'none',
  letterSpacing: '0.08em',
})
const emptyStyle = css({ color: 'var(--muted, #8b949e)' })

const tableStyle = css({
  width: '100%',
  borderCollapse: 'collapse',
  background: 'var(--panel, #161b22)',
  border: 'var(--border-w, 1px) solid var(--border, #2b333d)',
  borderRadius: 'var(--radius-lg, 12px)',
  boxShadow: 'var(--shadow-panel, none)',
  overflow: 'hidden',
})
const thStyle = css({
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: '11px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--muted, #8b949e)',
  borderBottom: '1px solid var(--border, #2b333d)',
})
const rightStyle = css({ textAlign: 'right' })
const sortLinkStyle = css({
  color: 'inherit',
  textDecoration: 'none',
  cursor: 'pointer',
  letterSpacing: 'inherit',
  textTransform: 'inherit',
  '&:hover': { color: 'var(--text, #e6edf3)' },
})
const sortActiveStyle = css({ color: 'var(--accent, #2dacf9)' })
const caretStyle = css({ fontSize: '8px', marginLeft: '4px', verticalAlign: 'middle' })
const rowStyle = css({ '&:not(:last-child) td': { borderBottom: '1px solid var(--border, #2b333d)' } })
const tdStyle = css({ padding: '12px 16px' })
const rankStyle = css({ color: 'var(--muted, #8b949e)', width: '48px' })
const timeStyle = css({ fontVariantNumeric: 'tabular-nums', fontWeight: 700 })
const watchStyle = css({ color: 'var(--accent, #2dacf9)', textDecoration: 'none' })
