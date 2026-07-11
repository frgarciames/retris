import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { ProfileGame, ProfileGamesPage } from '../data/profile.ts'
import { getMode } from '../game/modes.ts'
import { routes } from '../routes.ts'
import { AppShell, type ShellUser } from './layout.tsx'
import type { Theme } from './themes.ts'

export const PAGE_SIZE = 20

export interface ProfilePageProps {
  user: ShellUser
  theme?: Theme
  games: ProfileGamesPage
}

// Resolves a stored mode id to its display label ("sprint20" → "20 Lines",
// "versus" → "1vs1"), falling back to the raw id for unknown modes.
function modeLabel(modeId: string): string {
  return getMode(modeId)?.label ?? modeId
}

// DD/MM/YYYY in the viewer's locale-independent form.
function formatDate(ms: number): string {
  let d = new Date(ms)
  let dd = String(d.getDate()).padStart(2, '0')
  let mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function replayHref(game: ProfileGame): string {
  return game.kind === 'versus'
    ? routes.versus.show.href({ id: String(game.id) })
    : routes.games.show.href({ id: String(game.id) })
}

export function ProfilePage(handle: Handle<ProfilePageProps>) {
  return () => {
    let { user, theme, games } = handle.props
    return (
      <AppShell user={user} theme={theme} title={`${user.username} · Retris`} noindex>
        <h1 mix={titleStyle}>{user.username}</h1>
        {user.email ? <p mix={emailStyle}>{user.email}</p> : null}
        <p mix={introStyle}>
          Every run you have played — solo sprints and 1v1 matches. Newest first.
        </p>

        <section mix={sectionStyle}>
          <h2 mix={headingStyle}>
            Games
            <span mix={countStyle}>{games.total} total</span>
          </h2>
          {games.items.length === 0 ? (
            <p mix={emptyStyle}>
              No games yet.{' '}
              <a href={routes.home.href()} mix={watchStyle}>
                Play a round
              </a>{' '}
              to start your history.
            </p>
          ) : (
            <table mix={tableStyle}>
              <thead>
                <tr>
                  <th mix={thStyle}>#</th>
                  <th mix={thStyle}>Mode</th>
                  <th mix={thStyle}>Date</th>
                  <th mix={[thStyle, rightStyle]}>Replay</th>
                </tr>
              </thead>
              <tbody>
                {games.items.map((game, i) => (
                  <tr key={`${game.kind}-${game.id}`} mix={rowStyle}>
                    <td mix={[tdStyle, rankStyle]}>{(games.page - 1) * PAGE_SIZE + i + 1}</td>
                    <td mix={tdStyle}>
                      {modeLabel(game.modeId)}
                      {game.kind === 'versus' ? (
                        <span mix={[resultStyle, game.won ? wonStyle : lostStyle]}>
                          {game.won ? 'Won' : 'Lost'}
                        </span>
                      ) : null}
                    </td>
                    <td mix={[tdStyle, mutedCellStyle]}>{formatDate(game.created_at)}</td>
                    <td mix={[tdStyle, rightStyle]}>
                      <a href={replayHref(game)} mix={watchStyle}>
                        Watch
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Pager page={games.page} pages={games.pages} />
        </section>
      </AppShell>
    )
  }
}

function Pager(handle: Handle<{ page: number; pages: number }>) {
  return () => {
    let { page, pages } = handle.props
    if (pages <= 1) return null
    let href = (p: number) => `${routes.profile.href()}?page=${p}`
    return (
      <nav mix={pagerStyle}>
        {page > 1 ? (
          <a href={href(page - 1)} mix={pagerLinkStyle}>
            ← Prev
          </a>
        ) : (
          <span mix={pagerDisabledStyle}>← Prev</span>
        )}
        <span mix={pagerInfoStyle}>
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <a href={href(page + 1)} mix={pagerLinkStyle}>
            Next →
          </a>
        ) : (
          <span mix={pagerDisabledStyle}>Next →</span>
        )}
      </nav>
    )
  }
}

const titleStyle = css({
  margin: '0 0 4px',
  fontSize: '24px',
  fontFamily: 'var(--font-display, var(--font))',
  letterSpacing: 'var(--tracking, 0.04em)',
})
const emailStyle = css({ margin: '0 0 8px', color: 'var(--muted, #8b949e)', fontSize: '14px' })
const introStyle = css({ margin: '0 0 8px', color: 'var(--muted, #8b949e)' })

const sectionStyle = css({ marginTop: '32px' })
const headingStyle = css({
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
const countStyle = css({ letterSpacing: '0.08em' })
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
const rowStyle = css({
  '&:not(:last-child) td': { borderBottom: '1px solid var(--border, #2b333d)' },
})
const tdStyle = css({ padding: '12px 16px' })
const rankStyle = css({ color: 'var(--muted, #8b949e)', width: '48px' })
const mutedCellStyle = css({ color: 'var(--muted, #8b949e)' })
const watchStyle = css({ color: 'var(--accent, #2dacf9)', textDecoration: 'none' })

const resultStyle = css({
  marginLeft: '10px',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  padding: '2px 7px',
  borderRadius: '999px',
  border: '1px solid currentColor',
})
const wonStyle = css({ color: 'var(--accent, #2dacf9)' })
const lostStyle = css({ color: 'var(--muted, #8b949e)' })

const pagerStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  marginTop: '12px',
})
const pagerLinkStyle = css({ color: 'var(--accent, #2dacf9)', textDecoration: 'none' })
const pagerDisabledStyle = css({ color: 'var(--muted, #8b949e)', opacity: 0.5 })
const pagerInfoStyle = css({ color: 'var(--muted, #8b949e)', fontSize: '12px' })
