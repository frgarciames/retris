import type { Handle } from "remix/ui";
import { css } from "remix/ui";

import { ConfirmDelete } from "../assets/confirm-delete.tsx";
import type { GameListItem, UserListItem } from "../data/admin.ts";
import { routes } from "../routes.ts";
import { formatTime } from "../utils/format.ts";
import { AppShell, type ShellUser } from "./layout.tsx";
import type { Theme } from "./themes.ts";

export const PAGE_SIZE = 20;

export interface PageState<T> {
  items: T[];
  page: number;
  pages: number;
  total: number;
}

export interface AdminPageProps {
  user: ShellUser;
  theme?: Theme;
  // The admin's own user id; their row renders without a delete button.
  selfId: number;
  users: PageState<UserListItem>;
  games: PageState<GameListItem>;
}

// Both tables paginate independently via ?users=&games=; every link and delete
// form carries both page numbers so paging one table does not reset the other.
function pageHref(usersPage: number, gamesPage: number): string {
  return `${routes.admin.index.href()}?users=${usersPage}&games=${gamesPage}`;
}

function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16).replace("T", " ");
}

export function AdminPage(handle: Handle<AdminPageProps>) {
  return () => {
    let { user, theme, selfId, users, games } = handle.props;
    return (
      <AppShell user={user} theme={theme} title="Admin · Retris" noindex>
        <h1 mix={titleStyle}>Admin</h1>
        <p mix={introStyle}>
          Deleting a user removes their account and every game they own. Deletions are immediate and
          cannot be undone.
        </p>

        <section mix={sectionStyle}>
          <h2 mix={headingStyle}>
            Users
            <span mix={countStyle}>{users.total} total</span>
          </h2>
          {users.items.length === 0 ? (
            <p mix={emptyStyle}>No users.</p>
          ) : (
            <table mix={tableStyle}>
              <thead>
                <tr>
                  <th mix={thStyle}>ID</th>
                  <th mix={thStyle}>Username</th>
                  <th mix={thStyle}>Email</th>
                  <th mix={[thStyle, rightStyle]}>Games</th>
                  <th mix={thStyle}>Created</th>
                  <th mix={[thStyle, rightStyle]}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.items.map(({ user: row, gameCount }) => (
                  <tr key={row.id} mix={rowStyle}>
                    <td mix={[tdStyle, mutedCellStyle]}>{row.id}</td>
                    <td mix={tdStyle}>{row.username}</td>
                    <td mix={[tdStyle, mutedCellStyle]}>{row.email ?? "—"}</td>
                    <td mix={[tdStyle, rightStyle]}>{gameCount}</td>
                    <td mix={[tdStyle, mutedCellStyle]}>{formatDate(row.created_at)}</td>
                    <td mix={[tdStyle, rightStyle]}>
                      {row.id === selfId ? (
                        <span mix={mutedCellStyle}>you</span>
                      ) : (
                        <ConfirmDelete
                          action={routes.admin.deleteUser.href({ id: String(row.id) })}
                          message={`Delete user “${row.username}” and ${
                            gameCount === 1 ? "their 1 game" : `their ${gameCount} games`
                          }?`}
                          usersPage={users.page}
                          gamesPage={games.page}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Pager page={users.page} pages={users.pages} href={(p) => pageHref(p, games.page)} />
        </section>

        <section mix={sectionStyle}>
          <h2 mix={headingStyle}>
            Games
            <span mix={countStyle}>{games.total} total</span>
          </h2>
          {games.items.length === 0 ? (
            <p mix={emptyStyle}>No games.</p>
          ) : (
            <table mix={tableStyle}>
              <thead>
                <tr>
                  <th mix={thStyle}>ID</th>
                  <th mix={thStyle}>Player</th>
                  <th mix={thStyle}>Mode</th>
                  <th mix={[thStyle, rightStyle]}>Time</th>
                  <th mix={thStyle}>Created</th>
                  <th mix={[thStyle, rightStyle]}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {games.items.map(({ game, username }) => (
                  <tr key={game.id} mix={rowStyle}>
                    <td mix={[tdStyle, mutedCellStyle]}>{game.id}</td>
                    <td mix={tdStyle}>{username}</td>
                    <td mix={tdStyle}>{game.mode}</td>
                    <td mix={[tdStyle, rightStyle, timeStyle]}>{formatTime(game.duration_ms)}</td>
                    <td mix={[tdStyle, mutedCellStyle]}>{formatDate(game.created_at)}</td>
                    <td mix={[tdStyle, rightStyle]}>
                      <span mix={actionsCellStyle}>
                        <a href={routes.games.show.href({ id: String(game.id) })} mix={watchStyle}>
                          Watch
                        </a>
                        <ConfirmDelete
                          action={routes.admin.deleteGame.href({ id: String(game.id) })}
                          message={`Delete game #${game.id} by “${username}”?`}
                          usersPage={users.page}
                          gamesPage={games.page}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Pager page={games.page} pages={games.pages} href={(p) => pageHref(users.page, p)} />
        </section>
      </AppShell>
    );
  };
}

interface PagerProps {
  page: number;
  pages: number;
  href: (page: number) => string;
}

function Pager(handle: Handle<PagerProps>) {
  return () => {
    let { page, pages, href } = handle.props;
    if (pages <= 1) return null;
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
    );
  };
}

const titleStyle = css({
  margin: "0 0 8px",
  fontSize: "24px",
  fontFamily: "var(--font-display, var(--font))",
  letterSpacing: "var(--tracking, 0.04em)",
});
const introStyle = css({ margin: "0 0 8px", color: "var(--muted, #8b949e)" });

const sectionStyle = css({ marginTop: "32px" });
const headingStyle = css({
  margin: "0 0 16px",
  fontSize: "13px",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--muted, #8b949e)",
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "12px",
});
const countStyle = css({ letterSpacing: "0.08em" });
const emptyStyle = css({ color: "var(--muted, #8b949e)" });

const tableStyle = css({
  width: "100%",
  borderCollapse: "collapse",
  background: "var(--panel, #161b22)",
  border: "var(--border-w, 1px) solid var(--border, #2b333d)",
  borderRadius: "var(--radius-lg, 12px)",
  boxShadow: "var(--shadow-panel, none)",
  overflow: "hidden",
});
const thStyle = css({
  textAlign: "left",
  padding: "12px 16px",
  fontSize: "11px",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--muted, #8b949e)",
  borderBottom: "1px solid var(--border, #2b333d)",
});
const rightStyle = css({ textAlign: "right" });
const rowStyle = css({
  "&:not(:last-child) td": { borderBottom: "1px solid var(--border, #2b333d)" },
});
const tdStyle = css({ padding: "12px 16px" });
const mutedCellStyle = css({ color: "var(--muted, #8b949e)" });
const timeStyle = css({ fontVariantNumeric: "tabular-nums", fontWeight: 700 });
const watchStyle = css({ color: "var(--accent, #2dacf9)", textDecoration: "none" });

const actionsCellStyle = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "12px",
});

const pagerStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  marginTop: "12px",
});
const pagerLinkStyle = css({ color: "var(--accent, #2dacf9)", textDecoration: "none" });
const pagerDisabledStyle = css({ color: "var(--muted, #8b949e)", opacity: 0.5 });
const pagerInfoStyle = css({ color: "var(--muted, #8b949e)", fontSize: "12px" });
