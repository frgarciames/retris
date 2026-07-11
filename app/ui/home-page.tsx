import type { Handle } from "remix/ui";
import { css } from "remix/ui";

import { GameBoard } from "../assets/game-board.tsx";
import { getMode, type GameMode } from "../game/modes.ts";
import { routes } from "../routes.ts";
import { AppShell, type ShellUser } from "./layout.tsx";
import { homeStructuredData, JsonLd, SITE } from "./seo.tsx";
import type { Theme } from "./themes.ts";

export interface HomePageProps {
  user?: ShellUser | null;
  theme?: Theme;
  // The run hosted on this page. Anyone can play; anonymous finishes are
  // parked in the session and claimed at sign-in.
  seed: number;
  mode: string;
  modes: GameMode[];
}

export function HomePage(handle: Handle<HomePageProps>) {
  return () => {
    let { user, theme, seed, mode, modes } = handle.props;
    let label = getMode(mode)?.label ?? mode;
    let isSprint = getMode(mode)?.goal.type === "lines";
    return (
      <AppShell
        user={user}
        theme={theme}
        title="Retris · Free Falling-Blocks Puzzle Game"
        description={SITE.description}
        canonical={routes.home.href()}
        head={<JsonLd data={homeStructuredData()} />}
      >
        <h1 mix={titleStyle}>{isSprint ? `${label} Sprint` : label}</h1>
        <nav mix={modeRowStyle} aria-label="Game mode">
          {modes.map((m) => (
            <a
              key={m.id}
              href={`${routes.home.href()}?mode=${m.id}`}
              mix={m.id === mode ? [modeLinkStyle, modeActiveStyle] : modeLinkStyle}
            >
              {m.label}
            </a>
          ))}
          <a href={routes.versus.index.href()} mix={[modeLinkStyle, versusLinkStyle]}>
            1vs1
          </a>
        </nav>
        <GameBoard
          seed={seed}
          mode={mode}
          submitHref={routes.games.submit.href()}
          loginHref={routes.auth.login.index.href()}
          signupHref={routes.auth.signup.index.href()}
        />
        {!user ? (
          <p mix={anonHintStyle}>
            Playing as a guest — finish a run and sign in to put it on the{" "}
            <a href={routes.leaderboard.href()} mix={hintLinkStyle}>
              leaderboard
            </a>
            .
          </p>
        ) : null}
      </AppShell>
    );
  };
}

const titleStyle = css({
  margin: "0 0 12px",
  fontSize: "20px",
  textAlign: "center",
  fontFamily: "var(--font-display, var(--font))",
  letterSpacing: "var(--tracking, 0.04em)",
  "@media (max-width: 640px)": { display: "none" },
});
const modeRowStyle = css({
  display: "flex",
  justifyContent: "center",
  flexWrap: "wrap",
  gap: "12px",
  margin: "0 0 20px",
  "@media (max-width: 640px)": {
    justifyContent: "center",
    margin: "0 0 10px",
  },
});
const modeLinkStyle = css({
  padding: "5px 14px",
  borderRadius: "var(--radius-sm, 8px)",
  border: "var(--border-w, 1px) solid var(--border, #2b333d)",
  color: "var(--muted, #8b949e)",
  textDecoration: "none",
  fontSize: "12px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
});
const modeActiveStyle = css({
  background: "var(--accent, #2dacf9)",
  borderColor: "var(--accent, #2dacf9)",
  color: "var(--accent-ink, #04121d)",
  fontWeight: 700,
});
// Sets the live 1v1 entry point apart from the solo sprint switches.
const versusLinkStyle = css({
  borderColor: "var(--accent, #2dacf9)",
  color: "var(--accent, #2dacf9)",
  fontWeight: 700,
});
const anonHintStyle = css({
  margin: "16px 0 0",
  textAlign: "center",
  fontSize: "12px",
  color: "var(--muted, #8b949e)",
  "@media (max-width: 640px)": { display: "none" },
});
const hintLinkStyle = css({ color: "var(--accent, #2dacf9)", textDecoration: "none" });
