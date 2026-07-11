import type { Handle } from "remix/ui";
import { css } from "remix/ui";

import { ReplayPlayer } from "../../assets/replay-player.tsx";
import type { Game } from "../../data/schema.ts";
import { getMode, rankingKind } from "../../game/modes.ts";
import { routes } from "../../routes.ts";
import { AppShell } from "../../ui/layout.tsx";
import type { Theme } from "../../ui/themes.ts";
import { formatClassicScore, formatTime } from "../../utils/format.ts";

export interface ReplayPageProps {
  game: Game;
  username: string;
  viewer?: { username: string } | null;
  theme?: Theme;
}

export function ReplayPage(handle: Handle<ReplayPageProps>) {
  return () => {
    let { game, username, viewer, theme } = handle.props;
    let mode = getMode(game.mode);
    let modeLabel = mode?.label ?? game.mode;
    let isClassic = mode ? rankingKind(mode) === "levelTime" : false;
    let headline = isClassic
      ? formatClassicScore(game.level, game.duration_ms)
      : formatTime(game.duration_ms);
    let detail = isClassic
      ? `${username} · ${modeLabel} · ${game.lines_cleared} lines cleared`
      : `${username} · ${modeLabel} · ${game.lines_cleared} lines`;
    let description = isClassic
      ? `${username} reached level ${game.level} in ${formatClassicScore(game.level, game.duration_ms)} (${modeLabel}). Watch the full replay on Retris.`
      : `${username} cleared ${game.lines_cleared} lines in ${formatTime(game.duration_ms)} (${modeLabel}). Watch the full replay on Retris.`;
    return (
      <AppShell
        user={viewer}
        theme={theme}
        title={`${username}'s ${modeLabel} run · Retris`}
        description={description}
        canonical={routes.games.show.href({ id: String(game.id) })}
      >
        <div mix={headStyle}>
          <div>
            <h1 mix={titleStyle}>{headline}</h1>
            <p mix={subStyle}>{detail}</p>
          </div>
        </div>
        <ReplayPlayer seed={game.seed} mode={game.mode} actionsJson={game.actions} />
      </AppShell>
    );
  };
}

const headStyle = css({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  marginBottom: "20px",
});
const titleStyle = css({
  margin: 0,
  fontSize: "28px",
  fontFamily: "var(--font-display, var(--font))",
  fontVariantNumeric: "tabular-nums",
});
const subStyle = css({ margin: "6px 0 0", color: "var(--muted, #8b949e)" });
