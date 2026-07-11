// Selectable UI themes. A theme is not just a palette — it defines the whole
// personality of the app: colors, typography, corner shapes, border weight,
// shadows/glows, background treatment, and an optional full-screen effect
// (CRT scanlines, neon grid). Every component reads these as CSS custom
// properties set on the shell root, so adding a theme here restyles the entire
// app — board, panels, forms, buttons — with no per-page work.
//
// Tetromino colors are intentionally not themed; pieces keep their standard
// guideline identity.

export type ColorScheme = "light" | "dark";
export type ThemeOverlay = "none" | "scanlines" | "grid";

export interface ThemeColors {
  bg: string;
  panel: string;
  panel2: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentInk: string; // text/icon color on top of an accent fill
}

export interface ThemeFont {
  /** Body font stack. */
  stack: string;
  /** Display stack for the brand, hero, and big CTAs (falls back to body). */
  displayStack?: string;
  /** Google Fonts stylesheet for the fonts this theme needs. */
  href: string;
  /** Base body font size — pixel fonts like VT323 need a bigger base. */
  baseSize: string;
  /** Tracking used by the brand and display headings. */
  tracking: string;
}

export interface ThemeShape {
  radiusSm: string; // inputs, small buttons
  radiusMd: string; // CTAs, board frame
  radiusLg: string; // panels, cards, tables
  radiusCell: string; // playfield cells
  borderWidth: string;
}

export interface ThemeFx {
  /** Box shadow for panels/cards. */
  panelShadow: string;
  /** Glow/shadow applied to accent-filled buttons. */
  accentGlow: string;
  /** background-image for the page (gradients); 'none' for flat. */
  bgImage: string;
  /** Full-screen effect layered over the app. */
  overlay: ThemeOverlay;
}

export interface Theme {
  id: string;
  label: string;
  scheme: ColorScheme;
  colors: ThemeColors;
  font: ThemeFont;
  shape: ThemeShape;
  fx: ThemeFx;
}

const MONO_FALLBACK = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

export const THEMES: Record<string, Theme> = {
  // The original look: calm slate-blue dark mode.
  midnight: {
    id: "midnight",
    label: "Midnight",
    scheme: "dark",
    colors: {
      bg: "#0e1116",
      panel: "#161b22",
      panel2: "#1f2630",
      border: "#2b333d",
      text: "#e6edf3",
      muted: "#8b949e",
      accent: "#2dacf9",
      accentInk: "#04121d",
    },
    font: {
      stack: `'JetBrains Mono', ${MONO_FALLBACK}`,
      href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap",
      baseSize: "14px",
      tracking: "0.18em",
    },
    shape: {
      radiusSm: "8px",
      radiusMd: "10px",
      radiusLg: "12px",
      radiusCell: "2px",
      borderWidth: "1px",
    },
    fx: {
      panelShadow: "none",
      accentGlow: "none",
      bgImage: "none",
      overlay: "none",
    },
  },

  // Soft pastel lavender — light, round, cozy lo-fi.
  aesthetic: {
    id: "aesthetic",
    label: "Aesthetic",
    scheme: "light",
    colors: {
      bg: "#f3eef9",
      panel: "#ffffff",
      panel2: "#f0e7f7",
      border: "#e6dcef",
      text: "#463a54",
      muted: "#998aa8",
      accent: "#b56ad6",
      accentInk: "#ffffff",
    },
    font: {
      stack: "'Nunito', 'Avenir Next', 'Segoe UI', system-ui, sans-serif",
      href: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&display=swap",
      baseSize: "15px",
      tracking: "0.1em",
    },
    shape: {
      radiusSm: "12px",
      radiusMd: "16px",
      radiusLg: "22px",
      radiusCell: "4px",
      borderWidth: "1px",
    },
    fx: {
      panelShadow: "0 12px 32px rgba(150, 110, 200, 0.18)",
      accentGlow: "0 8px 20px rgba(181, 106, 214, 0.35)",
      bgImage: "linear-gradient(160deg, #f8effc 0%, #efe6fa 45%, #e7f0fb 100%)",
      overlay: "none",
    },
  },

  // Deep-space cyber — sharp edges, neon teal glow, holo grid.
  futuristic: {
    id: "futuristic",
    label: "Futuristic",
    scheme: "dark",
    colors: {
      bg: "#05070e",
      panel: "#0b1220",
      panel2: "#101c33",
      border: "#213760",
      text: "#d4e7ff",
      muted: "#6781b6",
      accent: "#29f0e0",
      accentInk: "#00120f",
    },
    font: {
      stack: `'Share Tech Mono', ${MONO_FALLBACK}`,
      displayStack: "'Orbitron', 'Share Tech Mono', sans-serif",
      href: "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Share+Tech+Mono&display=swap",
      baseSize: "15px",
      tracking: "0.28em",
    },
    shape: {
      radiusSm: "2px",
      radiusMd: "3px",
      radiusLg: "6px",
      radiusCell: "1px",
      borderWidth: "1px",
    },
    fx: {
      panelShadow: "0 0 0 1px rgba(41, 240, 224, 0.07), 0 0 28px rgba(41, 240, 224, 0.06)",
      accentGlow: "0 0 16px rgba(41, 240, 224, 0.5)",
      bgImage: "radial-gradient(ellipse 120% 80% at 50% -20%, #0e1d3a 0%, #05070e 60%)",
      overlay: "grid",
    },
  },

  // Green phosphor Game Boy CRT — pixel font, square corners, scanlines.
  retro: {
    id: "retro",
    label: "Retro",
    scheme: "dark",
    colors: {
      bg: "#0c1709",
      panel: "#112a10",
      panel2: "#173816",
      border: "#2c5a23",
      text: "#b7f29a",
      muted: "#6fa256",
      accent: "#8be34a",
      accentInk: "#0a1606",
    },
    font: {
      stack: "'VT323', 'Courier New', monospace",
      href: "https://fonts.googleapis.com/css2?family=VT323&display=swap",
      baseSize: "18px",
      tracking: "0.12em",
    },
    shape: {
      radiusSm: "0px",
      radiusMd: "0px",
      radiusLg: "0px",
      radiusCell: "0px",
      borderWidth: "2px",
    },
    fx: {
      panelShadow: "none",
      accentGlow: "none",
      bgImage: "none",
      overlay: "scanlines",
    },
  },
};

export const THEME_LIST: Theme[] = Object.values(THEMES);
export const DEFAULT_THEME = "midnight";

export function getTheme(id: string | null | undefined): Theme {
  return (id && THEMES[id]) || THEMES[DEFAULT_THEME]!;
}

export function isValidTheme(id: string): boolean {
  return id in THEMES;
}

// CSS custom properties for a theme, to spread onto an element's `style`.
export function themeVars(theme: Theme): Record<string, string> {
  let { colors: c, font: f, shape: s, fx } = theme;
  return {
    "--bg": c.bg,
    "--panel": c.panel,
    "--panel-2": c.panel2,
    "--border": c.border,
    "--text": c.text,
    "--muted": c.muted,
    "--accent": c.accent,
    "--accent-ink": c.accentInk,
    "--font": f.stack,
    "--font-display": f.displayStack ?? f.stack,
    "--fs-base": f.baseSize,
    "--tracking": f.tracking,
    "--radius-sm": s.radiusSm,
    "--radius-md": s.radiusMd,
    "--radius-lg": s.radiusLg,
    "--radius-cell": s.radiusCell,
    "--border-w": s.borderWidth,
    "--shadow-panel": fx.panelShadow,
    "--glow": fx.accentGlow,
    "--bg-image": fx.bgImage,
    // The full-screen overlays are always in the DOM; these vars switch the
    // active one on, which lets a client-side theme change toggle them
    // without a server re-render.
    "--fx-scanlines": fx.overlay === "scanlines" ? "block" : "none",
    "--fx-grid": fx.overlay === "grid" ? "block" : "none",
  };
}
