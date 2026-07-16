import type { Handle, RemixNode } from "remix/ui";
import { css } from "remix/ui";

import { MobileHeaderMenu } from "../assets/mobile-header-menu.tsx";
import { ThemeSwitcher } from "../assets/theme-switcher.tsx";
import { routes } from "../routes.ts";
import { isAdmin } from "../utils/admin.ts";
import { Document } from "./document.tsx";
import { Seo } from "./seo.tsx";
import { DEFAULT_THEME, getTheme, themeVars, type Theme } from "./themes.ts";

export const FONT_STACK =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

export interface ShellUser {
  username: string;
  email?: string | null;
}

export interface AppShellProps {
  user?: ShellUser | null;
  theme?: Theme;
  title?: string;
  /** Meta description for this page; defaults to the site description. */
  description?: string;
  /** Canonical path/URL for this page (also used for og:url). */
  canonical?: string;
  /** Keep this page out of search results (private/auth pages). */
  noindex?: boolean;
  head?: RemixNode;
  children?: RemixNode;
}

export function AppShell(handle: Handle<AppShellProps>) {
  return () => {
    let { user, title, description, canonical, noindex, head, children } = handle.props;
    let theme = handle.props.theme ?? getTheme(DEFAULT_THEME);
    return (
      <Document
        title={title}
        head={
          <>
            <meta name="color-scheme" content={theme.scheme} />
            <Seo
              title={title}
              description={description}
              canonical={canonical}
              noindex={noindex}
              themeColor={theme.colors.bg}
            />
            <FontHead href={theme.font.href} />
            {head}
          </>
        }
      >
        <div mix={rootStyle} style={themeVars(theme)} data-theme={theme.id}>
          {/* Both overlays are always present; --fx-scanlines/--fx-grid pick
              the active one so client-side theme switches can toggle them. */}
          <div mix={scanlinesStyle} aria-hidden="true" />
          <div mix={gridStyle} aria-hidden="true" />
          <header mix={headerStyle}>
            <a href={routes.home.href()} mix={brandStyle}>
              RETRIS
            </a>
            <div mix={desktopClusterStyle}>
              <nav mix={navStyle}>
                <HeaderLinks user={user} />
              </nav>
              <ThemeSwitcher current={theme.id} action={routes.theme.href()} />
            </div>
            <MobileHeaderMenu
              username={user?.username ?? null}
              isAdminUser={!!user && isAdmin(user)}
              currentTheme={theme.id}
              themeAction={routes.theme.href()}
              homeHref={routes.home.href()}
              versusHref={routes.versus.index.href()}
              leaderboardHref={routes.leaderboard.href()}
              profileHref={routes.profile.href()}
              adminHref={routes.admin.index.href()}
              loginHref={routes.auth.login.index.href()}
              signupHref={routes.auth.signup.index.href()}
              logoutHref={routes.auth.logout.href()}
            />
          </header>
          <main mix={mainStyle} id="game">
            {children}
          </main>
        </div>
      </Document>
    );
  };
}

function HeaderLinks(handle: Handle<{ user?: ShellUser | null }>) {
  return () => {
    let user = handle.props.user;
    return (
      <>
        <a href={routes.home.href()}>Play</a>
        <a href={routes.versus.index.href()}>1vs1</a>
        <a href={routes.leaderboard.href()}>Leaderboard</a>
        {user ? (
          <>
            {isAdmin(user) && <a href={routes.admin.index.href()}>Admin</a>}
            <a href={routes.profile.href()} mix={whoStyle}>
              {user.username}
            </a>
            <form method="post" action={routes.auth.logout.href()} mix={logoutFormStyle}>
              <button type="submit" mix={linkButtonStyle}>
                Log out
              </button>
            </form>
          </>
        ) : (
          <>
            <a href={routes.auth.login.index.href()}>Log in</a>
            <a href={routes.auth.signup.index.href()} mix={ctaStyle}>
              Sign up
            </a>
          </>
        )}
      </>
    );
  };
}

function FontHead(handle: Handle<{ href: string }>) {
  return () => (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* data-theme-font lets the client-side theme switcher retarget it. */}
      <link rel="stylesheet" href={handle.props.href} data-theme-font />
    </>
  );
}

const rootStyle = css({
  "& *, & *::before, & *::after": { boxSizing: "border-box" },
  position: "relative",
  minHeight: "100dvh",
  background: "var(--bg)",
  backgroundImage: "var(--bg-image, none)",
  backgroundAttachment: "fixed",
  color: "var(--text)",
  fontFamily: "var(--font)",
  fontSize: "var(--fs-base, 14px)",
  lineHeight: 1.5,
  display: "flex",
  flexDirection: "column",
  "@media (max-width: 1024px)": {
    backgroundAttachment: "scroll",
  },
});

// CRT scanlines (retro): thin repeating dark lines over the whole app.
const scanlinesStyle = css({
  display: "var(--fx-scanlines, none)",
  position: "fixed",
  inset: 0,
  zIndex: 40,
  pointerEvents: "none",
  background:
    "repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.22) 0px, rgba(0, 0, 0, 0.22) 1px, transparent 1px, transparent 3px)",
});

// Holo grid (futuristic): faint accent-tinted graph lines.
const gridStyle = css({
  display: "var(--fx-grid, none)",
  position: "fixed",
  inset: 0,
  zIndex: 0,
  pointerEvents: "none",
  backgroundImage:
    "linear-gradient(color-mix(in srgb, var(--accent) 6%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--accent) 6%, transparent) 1px, transparent 1px)",
  backgroundSize: "36px 36px",
});

const headerStyle = css({
  position: "relative",
  // Above main (zIndex 1): the mobile menu's fixed overlay lives inside the
  // header, so the header must out-stack main for the overlay to cover the
  // game board instead of being trapped beneath it. Kept below the scanlines
  // FX (zIndex 40) so the retro overlay still draws over the header/menu.
  zIndex: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap",
  padding: "16px 24px",
  borderBottom: "var(--border-w, 1px) solid var(--border)",
  background: "var(--panel)",
  boxShadow: "var(--shadow-panel, none)",
  "@media (max-width: 1024px)": {
    padding: "10px 12px",
    gap: "12px",
  },
});

const desktopClusterStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "20px",
  flexWrap: "wrap",
  "@media (max-width: 1024px)": { display: "none" },
});

const brandStyle = css({
  fontFamily: "var(--font-display, var(--font))",
  fontWeight: 700,
  letterSpacing: "var(--tracking, 0.18em)",
  fontSize: "18px",
  color: "var(--text)",
  textDecoration: "none",
  "@media (max-width: 1024px)": {
    position: "relative",
    zIndex: 4,
    textAlign: "left",
  },
});

const navStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "20px",
  flexWrap: "wrap",
  justifyContent: "center",
  "& a": {
    color: "var(--muted)",
    textDecoration: "none",
    transition: "color 120ms ease",
  },
  "& a:hover": { color: "var(--text)" },
  "@media (max-width: 1024px)": { gap: "12px 16px" },
});

const ctaStyle = css({
  padding: "7px 14px",
  borderRadius: "var(--radius-sm, 8px)",
  background: "var(--accent)",
  color: "var(--accent-ink) !important",
  boxShadow: "var(--glow, none)",
  fontWeight: 700,
});

const whoStyle = css({
  color: "var(--text)",
  fontWeight: 700,
  textDecoration: "none",
  "&:hover": { color: "var(--accent)" },
});
const logoutFormStyle = css({ margin: 0, display: "inline-flex" });
const linkButtonStyle = css({
  appearance: "none",
  border: 0,
  background: "transparent",
  color: "var(--muted)",
  font: "inherit",
  cursor: "pointer",
  padding: 0,
  "&:hover": { color: "var(--text)" },
});

const mainStyle = css({
  position: "relative",
  zIndex: 1,
  flex: 1,
  width: "100%",
  maxWidth: "960px",
  margin: "0 auto",
  padding: "32px 24px 64px",
  "@media (max-width: 1024px)": {
    padding: "20px 16px calc(32px + env(safe-area-inset-bottom))",
  },
});
