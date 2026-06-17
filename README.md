<div align="center">

# 🟦 Retris

**A competitive line-sprint Tetris-style with accounts, server-verified times, and full replays.**

Race the clock to clear your target lines, then watch any run back frame-for-frame.
Every leaderboard time is recomputed on the server from the recorded inputs — so the ranking is honest by construction.

Built on [**Remix 3**](https://remix.run) (beta) · zero runtime dependencies beyond `remix` · powered by Node's built-in SQLite.

</div>

---

## ✨ Highlights

- 🎮 **Modern guideline gameplay** — 7-bag randomizer, SRS rotation with wall kicks, ghost piece, hold, a 3-piece next queue, soft/hard drop, and DAS/ARR auto-shift.
- 🏁 **Line-sprint modes** — clear **40 Lines** or **20 Lines** as fast as you can. Modes live in a registry and are trivial to extend.
- 🔐 **Accounts** — username + password auth, hashed with scrypt (`node:crypto`). No third-party services, no secrets to provision in dev.
- 🎞️ **Replays** — every finished run is stored and replayable with play / pause / scrub.
- 🥇 **Honest leaderboards** — the server **re-simulates** each submission to derive the canonical time and line count. Client-reported times are never trusted.
- 🧩 **One engine, three jobs** — the same deterministic core powers live play, server verification, and replay.
- 🎨 **Themes** — switch between **Midnight**, **Aesthetic**, **Futuristic**, and **Retro** from the header; your choice is remembered.

---

## 🧠 How it works — the deterministic engine

The whole game is reproducible from a single 32-bit **seed** plus the list of **inputs**, each tagged with the tick it happened on. The simulation is a pure, DOM-free, fixed-timestep (60 Hz) state machine: given the same seed and inputs, it always produces the same board, the same line count, and the same finishing time.

That one property is what makes everything else simple:

```
                      ┌───────────────────────────────┐
   seed + your keys → │   app/game/engine.ts (pure)   │ ← deterministic, 60 Hz
                      └───────────────────────────────┘
                         │            │            │
              ┌──────────┘            │            └──────────┐
              ▼                       ▼                       ▼
        🕹️  PLAY                ✅  VERIFY                🎞️  REPLAY
   browser runs it live,   server re-runs the same   viewer re-runs it in
   recording {tick,action} inputs to compute the     playback, scrubbable
   for each input          authoritative time
```

- **Time is derived, not measured** — `duration = finishingTick × (1000 / 60) ms`. It can't drift between machines.
- **A replay is tiny** — just `seed + actions[]`, not a stream of board states.
- **Cheat-resistance is free** — to fake a fast time you'd have to submit inputs that *actually* clear the lines that fast. The server replays them and rejects anything that doesn't reach the goal.

---

## 🛠️ Tech stack

| Layer        | Choice                                                                 |
| ------------ | ---------------------------------------------------------------------- |
| Framework    | **Remix 3** (beta) — server-first, Web-API based, its own UI runtime (not React) |
| Runtime      | **Node ≥ 24.3** with the experimental built-in `node:sqlite`           |
| Database     | SQLite via `remix/data-table` + hand-written SQL migrations            |
| Auth         | Session cookies + `node:crypto` scrypt password hashing                |
| Styling      | `css()` mixins (CSS-in-JS, server-rendered, adopted as a stylesheet)   |
| Package mgr  | **pnpm**                                                               |

There are **no runtime dependencies** other than `remix` itself — the database driver and password hashing both come from the Node standard library.

---

## 🚀 Getting started

### Prerequisites

- **Node ≥ 24.3** (for built-in `node:sqlite`)
- **pnpm** (`npm i -g pnpm`)

### Install & run

```sh
pnpm install     # install dependencies
pnpm dev         # start the dev server (auto-restart on change)
```

Then open **http://localhost:44100**.

Migrations run automatically on startup, creating `db/retris.sqlite` on first boot. Sign up, hit **Play**, and clear some lines.

### Environment variables

| Variable         | Default              | Notes                                                                 |
| ---------------- | -------------------- | --------------------------------------------------------------------- |
| `SESSION_SECRET` | insecure dev secret  | Used to sign session cookies. **Required in production** (the app refuses to boot without it). |
| `ADMIN_USERNAME` | _(none in prod)_     | Username of the single admin account. Unset in production means **no** account is privileged (the admin view 404s); dev/test fall back to `admin@example.test`. |
| `PORT`           | `44100`              | HTTP port.                                                            |
| `NODE_ENV`       | `development`        | `production` enables secure cookies + minification; `test` uses in-memory DB & sessions. |

---

## 📜 Scripts

| Command           | What it does                                                              |
| ----------------- | ------------------------------------------------------------------------ |
| `pnpm dev`        | Run the server with `--watch` (restarts on file changes).                |
| `pnpm start`      | Run the server once (production-style).                                  |
| `pnpm migrate`    | Apply pending database migrations explicitly.                            |
| `pnpm test`       | Run the test suite (`node:test`) — engine, password hashing, HTTP flows. |
| `pnpm typecheck`  | Type-check the whole project with `tsc --noEmit`.                        |

---

## 🎯 Controls

| Action          | Keys                |
| --------------- | ------------------- |
| Move left/right | `←` `→`             |
| Soft drop       | `↓`                 |
| Hard drop       | `Space`             |
| Rotate CW       | `↑` / `X`           |
| Rotate CCW      | `Z` / `Ctrl`        |
| Hold            | `C` / `Shift`       |

---

## 🎨 Themes

Pick a theme from the swatches in the header — the choice is saved to a cookie and applied on every page (including the game board), with no page-specific work.

| Theme        | Vibe                                  |
| ------------ | ------------------------------------- |
| **Midnight** | Calm slate-blue dark mode (default)   |
| **Aesthetic**| Soft pastel lavender, light           |
| **Futuristic** | Deep-space black with neon teal     |
| **Retro**    | Green-phosphor / Game Boy CRT         |

A theme is just a set of CSS custom properties (`--bg`, `--panel`, `--accent`, …) in [`app/ui/themes.ts`](app/ui/themes.ts); the shell sets them on its root so they cascade everywhere. Adding one is a single entry there — the switcher and every page pick it up automatically.

## 🗂️ Project structure

```
app/
├─ routes.ts            # Typed URL contract (source of truth for hrefs)
├─ router.ts            # Middleware stack + controller wiring; exports AppContext
├─ assets.ts            # Source-asset server (compiles browser modules)
│
├─ actions/             # Controllers — return Response objects
│  ├─ controller.tsx    #   home (leaderboards) + assets
│  ├─ auth/             #   login · signup · logout
│  ├─ play/             #   the play page (requires auth)
│  └─ games/            #   submit (verify + store) · show (replay viewer)
│
├─ game/                # 🧠 Pure, deterministic, DOM-free engine (shared client+server)
│  ├─ engine.ts         #   tick-based state machine + simulate()
│  ├─ pieces.ts         #   tetromino shapes, SRS rotations & kick tables
│  ├─ rng.ts            #   seeded PRNG + 7-bag
│  └─ modes.ts          #   mode registry (40 Lines, 20 Lines, …)
│
├─ assets/              # Browser client entries & presentational UI
│  ├─ entry.ts          #   boots the client runtime (run())
│  ├─ game-board.tsx    #   live game: loop, input/DAS-ARR, submit-on-win
│  ├─ replay-player.tsx #   playback with scrubber
│  └─ board.tsx, game-view.tsx
│
├─ data/                # schema.ts + queries (users, games) + db.ts (sqlite + migrations)
├─ middleware/          # database · session · auth · render
├─ ui/                  # shared cross-route UI (layout, home, auth form, document)
└─ utils/               # pure helpers (passwords, time formatting, redirects)

db/migrations/          # hand-written SQL migrations (immutable, checksum-tracked)
public/                 # static files served as-is
server.ts               # Node HTTP adapter
```

---

## 🗄️ Database & migrations

- The database lives at `db/retris.sqlite` (git-ignored) and is opened with Node's built-in `node:sqlite`.
- Migrations are plain SQL files under `db/migrations/<timestamp>_<name>/{up,down}.sql`. They are **applied automatically on startup** and tracked by checksum, so they run exactly once.
- Two tables: **`users`** (id, username, password hash) and **`games`** (the stored replays — seed, mode, recorded actions JSON, plus the server-verified duration and line count).

To add a migration, create a new timestamped folder with an `up.sql` (and optional `down.sql`); it'll apply on the next boot or via `pnpm migrate`.

---

## ➕ Adding a game mode

Modes are data, not code paths. To add one, register it in [`app/game/modes.ts`](app/game/modes.ts):

```ts
export const MODES: Record<string, GameMode> = {
  sprint40: { id: 'sprint40', label: '40 Lines', goal: { type: 'lines', count: 40 } },
  sprint20: { id: 'sprint20', label: '20 Lines', goal: { type: 'lines', count: 20 } },
  // sprint100: { id: 'sprint100', label: '100 Lines', goal: { type: 'lines', count: 100 } },
}
```

The engine checks the goal generically, the play page exposes it via `/play?mode=<id>`, and the home page automatically renders a play button and a leaderboard for every registered mode. The `Goal` union is ready for new goal kinds (e.g. a timed mode) when you want them.

---

## 🧪 Testing

```sh
pnpm test
```

The suite (Node's built-in test runner) covers the parts that matter most:

- **Engine** — determinism (same seed + inputs ⇒ identical result), 7-bag fairness, line clears, and goal completion across modes.
- **Passwords** — scrypt hash/verify round-trips and rejection of bad input.
- **HTTP flows** — driving the router with real `Request`s: signup/login, and submitting a replay so the server re-simulation path (accept a real run, reject an incomplete/tampered one) is exercised end-to-end.

---

## 🌐 Production notes

```sh
SESSION_SECRET="$(openssl rand -hex 32)" NODE_ENV=production PORT=8080 pnpm start
```

In production the app:

- **requires** `SESSION_SECRET` and fails fast without it,
- marks session cookies `Secure` and minifies browser assets,
- persists sessions to `tmp/sessions/` and the database to `db/retris.sqlite`.

---

<div align="center">
<sub>Built with Remix 3 · clear forty, then clear it faster.</sub>
</div>
