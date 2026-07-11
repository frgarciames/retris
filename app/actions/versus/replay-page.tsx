import type { Handle } from "remix/ui";
import { css } from "remix/ui";

import { VersusReplay } from "../../assets/versus-replay-player.tsx";
import type { VersusGame } from "../../data/schema.ts";
import { VERSUS_MODE } from "../../game/modes.ts";
import { routes } from "../../routes.ts";
import { AppShell } from "../../ui/layout.tsx";
import type { Theme } from "../../ui/themes.ts";

export interface VersusReplayPageProps {
  game: VersusGame;
  viewer?: { username: string } | null;
  theme?: Theme;
}

export function VersusReplayPage(handle: Handle<VersusReplayPageProps>) {
  return () => {
    let { game, viewer, theme } = handle.props;
    return (
      <AppShell
        user={viewer}
        theme={theme}
        title={`${game.winner_name} vs ${game.loser_name} · 1vs1 · Retris`}
        description={`${game.winner_name} beat ${game.loser_name} ${game.winner_lines}–${game.loser_lines} lines. Watch the full 1v1 replay on Retris.`}
        canonical={routes.versus.show.href({ id: String(game.id) })}
      >
        <div mix={headStyle}>
          <h1 mix={titleStyle}>
            {game.winner_name} <span mix={beatStyle}>beat</span> {game.loser_name}
          </h1>
          <p mix={subStyle}>
            1vs1 · {game.winner_lines}–{game.loser_lines} lines
          </p>
        </div>
        <VersusReplay
          seed={game.seed}
          mode={VERSUS_MODE}
          winnerName={game.winner_name}
          loserName={game.loser_name}
          winnerActions={game.winner_actions}
          winnerGarbage={game.winner_garbage}
          loserActions={game.loser_actions}
          loserGarbage={game.loser_garbage}
        />
      </AppShell>
    );
  };
}

const headStyle = css({ marginBottom: "20px" });
const titleStyle = css({
  margin: 0,
  fontSize: "24px",
  fontFamily: "var(--font-display, var(--font))",
});
const beatStyle = css({ color: "var(--muted, #8b949e)", fontWeight: 400 });
const subStyle = css({ margin: "6px 0 0", color: "var(--muted, #8b949e)" });
