import {
  addEventListeners,
  clientEntry,
  css,
  on,
  type Handle,
  type SerializableProps,
} from "remix/ui";

import {
  applyGarbageNow,
  COLS,
  createInitialState,
  MS_PER_TICK,
  ROWS,
  step,
  type GameState,
  type RecordedAction,
} from "../game/engine.ts";
import { cellsFor } from "../game/pieces.ts";
import { buildTimeline, reconstructVersus, type RecordedGarbage } from "../game/versus-replay.ts";
import { Board, type BoardCell } from "./board.tsx";
import { GameView } from "./game-view.tsx";
import { InputController } from "./input.ts";
import { MobileControls } from "./mobile-controls.tsx";
import { isF4Shortcut, shouldRunF4Shortcut } from "./shortcuts.ts";

interface VersusBoardProps extends SerializableProps {
  mode: string;
  eventsHref: string;
  updateHref: string;
}

// 'connecting' → opening the SSE stream; 'waiting' → in the lobby; 'live' →
// matched and playing; 'finished' → match decided. While 'live', `interrupted`
// pauses both boards: 'self' = our connection dropped, 'opponent' = theirs did.
type Phase = "connecting" | "waiting" | "live" | "finished";
type Interrupted = null | "self" | "opponent";

const SNAPSHOT_MS = 150; // opponent-mirror refresh cadence
const RESUME_SAVE_MS = 250; // how often the resume recording is persisted locally
const CLIENT_ID_KEY = "retris:clientId";
const RESUME_KEY = "retris:versusResume";
const RESUME_MAX_AGE_MS = 5 * 60 * 1000;

export const VersusBoard = clientEntry(
  import.meta.url,
  function VersusBoard(handle: Handle<VersusBoardProps>) {
    let phase: Phase = "connecting";
    let interrupted: Interrupted = null;
    let result: "win" | "lose" | null = null;
    let resultReason = "";
    let opponentName = "Opponent";
    let opponentCells: number[] | null = null;
    let opponentLines = 0;

    let clientId = "";
    let seed = 0;
    // `hasLiveState` is true once we hold a real in-progress game (vs a fresh
    // page load), which is how a reconnect tells a network blip (state intact,
    // just resume) from a refresh (rebuild from the saved recording).
    let hasLiveState = false;
    let state: GameState = createInitialState(0, handle.props.mode);
    let input = new InputController();
    let countdown: number | "go" | null = 3;

    // Recording: our inputs and the garbage we received, both stamped by tick.
    // Powers replay storage and reconnect reconstruction.
    let recordedActions: RecordedAction[] = [];
    let recordedGarbage: RecordedGarbage[] = [];
    // Garbage holes that arrived since the last tick, applied instantly next tick.
    let incomingHoles: number[] = [];

    let prevLines = 0;
    let lastSnapshot = 0;
    let lastResumeSave = 0;

    let source: EventSource | null = null;
    let rafId = 0;
    let lastTime = 0;
    let acc = 0;
    let countdownTimer = 0;

    // ----- persistence (reconnect) -----

    function getClientId(): string {
      try {
        let id = localStorage.getItem(CLIENT_ID_KEY);
        if (!id) {
          id = Math.random().toString(36).slice(2) + Date.now().toString(36);
          localStorage.setItem(CLIENT_ID_KEY, id);
        }
        return id;
      } catch {
        return Math.random().toString(36).slice(2) + Date.now().toString(36);
      }
    }

    function saveResume() {
      try {
        localStorage.setItem(
          RESUME_KEY,
          JSON.stringify({
            clientId,
            mode: handle.props.mode,
            seed,
            opponentName,
            actions: recordedActions,
            garbage: recordedGarbage,
            tick: state.tick,
            savedAt: Date.now(),
          }),
        );
      } catch {
        // storage full or unavailable — resume just won't be possible
      }
    }

    function loadResume(): any {
      try {
        let raw = localStorage.getItem(RESUME_KEY);
        if (!raw) return null;
        let data = JSON.parse(raw);
        if (Date.now() - (data.savedAt ?? 0) > RESUME_MAX_AGE_MS) return null;
        return data;
      } catch {
        return null;
      }
    }

    function clearResume() {
      try {
        localStorage.removeItem(RESUME_KEY);
      } catch {
        // ignore
      }
    }

    // ----- networking -----

    function parse(event: Event): any {
      try {
        return JSON.parse((event as MessageEvent).data);
      } catch {
        return {};
      }
    }

    function connect() {
      phase = "connecting";
      let url = `${handle.props.eventsHref}?clientId=${encodeURIComponent(clientId)}`;
      let es = new EventSource(url);
      source = es;

      es.addEventListener("waiting", (e) => {
        let data = parse(e);
        if (hasLiveState && phase === "live" && !data.canceled) {
          // The server treats us as fresh: our match expired while we were away.
          es.close();
          finishMatch("lose", "Lost connection to the match");
          return;
        }
        phase = "waiting";
        hasLiveState = false;
        clearResume();
        handle.update();
      });

      es.addEventListener("start", (e) => {
        let data = parse(e);
        startMatch(Number(data.seed) >>> 0, data.opponent || "Opponent");
      });

      es.addEventListener("resume", (e) => {
        let data = parse(e);
        interrupted = null;
        if (hasLiveState) {
          // Network blip: our state is intact, just pick the loop back up.
          opponentName = data.opponent || opponentName;
          if (data.opponentBoard) {
            opponentCells = data.opponentBoard.board ?? opponentCells;
            opponentLines = data.opponentBoard.lines ?? opponentLines;
          }
          resumeLoop();
          handle.update();
        } else if (!rebuildFromStorage(data)) {
          // Reconnected into an active match but no local recording to rebuild
          // from (e.g. cleared storage): start fresh on the shared seed.
          startMatch(Number(data.seed) >>> 0, data.opponent || "Opponent");
        }
      });

      es.addEventListener("garbage", (e) => {
        if (phase !== "live" || state.status !== "playing") return;
        let count = Number(parse(e).count) || 0;
        for (let i = 0; i < count; i++) incomingHoles.push(Math.floor(Math.random() * COLS));
      });

      es.addEventListener("opponent", (e) => {
        let data = parse(e);
        if (Array.isArray(data.board)) opponentCells = data.board;
        opponentLines = Number(data.lines) || 0;
        handle.update();
      });

      es.addEventListener("opponent_disconnected", () => {
        if (phase !== "live") return;
        interrupted = "opponent";
        pauseLoop();
        handle.update();
      });
      es.addEventListener("opponent_reconnected", () => {
        if (interrupted === "opponent") {
          interrupted = null;
          resumeLoop();
        }
        handle.update();
      });

      // 'win' = the opponent lost or forfeited; 'lose' = they reached the goal first.
      es.addEventListener("win", (e) => {
        let reason = parse(e).reason;
        finishMatch(
          "win",
          reason === "surrendered" ? `${opponentName} surrendered` : `${opponentName} topped out`,
        );
      });
      es.addEventListener("lose", () => finishMatch("lose", `${opponentName} reached the goal`));
      es.addEventListener("opponent_left", () =>
        finishMatch("win", `${opponentName} did not reconnect`),
      );

      // A dropped stream while playing: pause and show "reconnecting". The
      // EventSource retries on its own; the server hands us 'resume' when it
      // reattaches.
      es.onerror = () => {
        if (phase === "live" && state.status === "playing" && !interrupted) {
          interrupted = "self";
          pauseLoop();
          handle.update();
        }
      };
    }

    // ----- snapshots / result reporting -----

    // Board exactly as the player sees it: settled cells plus the active piece,
    // so the opponent's mirror shows the live piece.
    function snapshotBoard(): number[] {
      let arr = Array.from(state.board);
      let active = state.active;
      if (active) {
        for (let [cx, cy] of cellsFor(active.type, active.rotation)) {
          let col = active.x + cx;
          let row = active.y + cy;
          if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
            arr[row * COLS + col] = active.type + 1;
          }
        }
      }
      return arr;
    }

    function postSnapshot(sent: number) {
      if (!clientId) return;
      let body = new FormData();
      body.set("clientId", clientId);
      body.set("board", JSON.stringify(snapshotBoard()));
      body.set("lines", String(state.linesCleared));
      body.set("status", state.status);
      body.set("sent", String(sent));
      fetch(handle.props.updateHref, { method: "POST", body, keepalive: true }).catch(() => {});
    }

    function postFinish(res: "won" | "lost", reason?: "surrendered") {
      if (!clientId) return;
      let body = new FormData();
      body.set("clientId", clientId);
      body.set("result", res);
      if (reason) body.set("reason", reason);
      body.set("actions", JSON.stringify(recordedActions));
      body.set("garbage", JSON.stringify(recordedGarbage));
      body.set("lines", String(state.linesCleared));
      fetch(handle.props.updateHref, { method: "POST", body, keepalive: true }).catch(() => {});
    }

    // ----- match lifecycle -----

    function startMatch(seedValue: number, name: string) {
      cancelAnimationFrame(rafId);
      clearTimeout(countdownTimer);
      seed = seedValue;
      opponentName = name || "Opponent";
      state = createInitialState(seed, handle.props.mode);
      input.reset();
      recordedActions = [];
      recordedGarbage = [];
      incomingHoles = [];
      prevLines = 0;
      acc = 0;
      lastSnapshot = 0;
      lastResumeSave = 0;
      countdown = 3;
      phase = "live";
      interrupted = null;
      hasLiveState = true;
      result = null;
      resultReason = "";
      opponentCells = null;
      opponentLines = 0;
      clearResume();
      runCountdown();
      handle.update();
    }

    // Rebuild an interrupted game from the locally saved recording, then resume.
    function rebuildFromStorage(data: any): boolean {
      let saved = loadResume();
      if (!saved || saved.clientId !== clientId || saved.mode !== handle.props.mode) return false;

      seed = Number(saved.seed) >>> 0;
      opponentName = data.opponent || saved.opponentName || "Opponent";
      recordedActions = Array.isArray(saved.actions) ? saved.actions : [];
      recordedGarbage = Array.isArray(saved.garbage) ? saved.garbage : [];
      let timeline = buildTimeline({
        seed,
        mode: handle.props.mode,
        actions: recordedActions,
        garbage: recordedGarbage,
      });
      state = reconstructVersus(timeline, saved.tick ?? timeline.finalTick);
      input.reset();
      incomingHoles = [];
      prevLines = state.linesCleared;
      if (data.opponentBoard) {
        opponentCells = data.opponentBoard.board ?? null;
        opponentLines = data.opponentBoard.lines ?? 0;
      }
      hasLiveState = true;
      phase = "live";
      interrupted = null;
      countdown = null; // resume straight into play, no fresh countdown
      if (state.status === "playing") {
        lastSnapshot = 0;
        lastResumeSave = 0;
        lastTime = performance.now();
        acc = 0;
        rafId = requestAnimationFrame(frame);
      }
      handle.update();
      return true;
    }

    // Same async-only update discipline as the single-player board: never call
    // handle.update() synchronously from render/setup (see game-board.tsx).
    function runCountdown() {
      countdownTimer = window.setTimeout(
        () => {
          if (countdown === "go") {
            countdown = null;
            lastTime = performance.now();
            rafId = requestAnimationFrame(frame);
          } else if (countdown === 1) {
            countdown = "go";
            runCountdown();
          } else if (typeof countdown === "number") {
            countdown--;
            runCountdown();
          }
          handle.update();
        },
        countdown === "go" ? 500 : 800,
      );
    }

    function pauseLoop() {
      cancelAnimationFrame(rafId);
    }

    function resumeLoop() {
      if (phase !== "live" || countdown !== null || state.status !== "playing" || interrupted)
        return;
      cancelAnimationFrame(rafId);
      lastTime = performance.now();
      acc = 0;
      rafId = requestAnimationFrame(frame);
    }

    function frame(now: number) {
      acc += now - lastTime;
      lastTime = now;
      if (acc > 250) acc = 250;
      while (acc >= MS_PER_TICK && state.status === "playing") {
        acc -= MS_PER_TICK;
        // Instant garbage: anything that arrived since the last tick lands now.
        if (incomingHoles.length > 0) {
          let holes = incomingHoles;
          incomingHoles = [];
          recordedGarbage.push({ tick: state.tick, holes: holes.slice() });
          applyGarbageNow(state, holes);
          if (state.status !== "playing") break;
        }
        let actions = input.collect();
        for (let action of actions) recordedActions.push({ tick: state.tick, action });
        step(state, actions);
      }

      // Lines cleared since the last frame are the garbage we send the opponent.
      let cleared = state.linesCleared - prevLines;
      prevLines = state.linesCleared;

      if (state.status !== "playing") {
        finishLocal(cleared);
        return;
      }

      if (cleared > 0) {
        postSnapshot(cleared);
        lastSnapshot = now;
      } else if (now - lastSnapshot >= SNAPSHOT_MS) {
        postSnapshot(0);
        lastSnapshot = now;
      }
      if (now - lastResumeSave >= RESUME_SAVE_MS) {
        saveResume();
        lastResumeSave = now;
      }
      handle.update();
      rafId = requestAnimationFrame(frame);
    }

    // Our game ended locally: 'won' reached the goal, anything else topped out.
    function finishLocal(cleared: number) {
      cancelAnimationFrame(rafId);
      if (phase === "finished") return;
      let won = state.status === "won";
      result = won ? "win" : "lose";
      resultReason = won ? "You reached the goal first" : "You topped out";
      phase = "finished";
      clearResume();
      postSnapshot(cleared);
      postFinish(won ? "won" : "lost");
      handle.update();
    }

    function surrender() {
      if (phase !== "live" || state.status !== "playing") return;
      cancelAnimationFrame(rafId);
      clearTimeout(countdownTimer);
      result = "lose";
      resultReason = "You surrendered";
      phase = "finished";
      interrupted = null;
      clearResume();
      postSnapshot(0);
      postFinish("lost", "surrendered");
      handle.update();
    }

    // The match ended because of the opponent (their result or their departure).
    function finishMatch(res: "win" | "lose", reason: string) {
      if (phase === "finished") return;
      cancelAnimationFrame(rafId);
      clearTimeout(countdownTimer);
      result = res;
      resultReason = reason;
      phase = "finished";
      interrupted = null;
      clearResume();
      // Report our own recording so the server can store both boards.
      postFinish(res === "win" ? "won" : "lost");
      handle.update();
    }

    function playAgain() {
      source?.close();
      cancelAnimationFrame(rafId);
      clearTimeout(countdownTimer);
      hasLiveState = false;
      interrupted = null;
      result = null;
      resultReason = "";
      opponentCells = null;
      opponentLines = 0;
      opponentName = "Opponent";
      recordedActions = [];
      recordedGarbage = [];
      incomingHoles = [];
      clearResume();
      connect();
      handle.update();
    }

    // ----- input -----

    function onKeyDown(event: KeyboardEvent) {
      if (isF4Shortcut(event.key) && phase === "live" && state.status === "playing") {
        if (shouldRunF4Shortcut(event.key, event.repeat)) surrender();
        event.preventDefault();
        return;
      }
      if (phase !== "live" || interrupted || countdown !== null || state.status !== "playing")
        return;
      if (input.keyDown(event.key, event.repeat)) event.preventDefault();
    }

    function onKeyUp(event: KeyboardEvent) {
      input.keyUp(event.key);
    }

    if (typeof window !== "undefined" && typeof requestAnimationFrame !== "undefined") {
      clientId = getClientId();
      addEventListeners(window, handle.signal, {
        keydown: onKeyDown,
        keyup: onKeyUp,
        blur() {
          input.reset();
        },
      });
      connect();
      handle.signal.addEventListener("abort", () => {
        cancelAnimationFrame(rafId);
        clearTimeout(countdownTimer);
        source?.close();
      });
    }

    return () => {
      if (phase === "connecting") {
        return <Lobby title="Connecting…" subtitle="Joining the 1vs1 lobby." />;
      }
      if (phase === "waiting") {
        return (
          <Lobby
            title="Waiting for an opponent…"
            subtitle="Hang tight — the match starts the moment someone joins."
          />
        );
      }

      let elapsedMs = state.tick * MS_PER_TICK;
      let canSurrender =
        phase === "live" && !interrupted && countdown === null && state.status === "playing";
      let canUseControls = canSurrender;
      let overlay =
        phase === "finished" ? (
          <div mix={overlayTextStyle}>
            <div mix={result === "win" ? [overlayBig, winStyle] : overlayBig}>
              {result === "win" ? "You win!" : "You lose"}
            </div>
            <div mix={overlayMuted}>{resultReason}</div>
            <button type="button" mix={[resumeBtnStyle, on("click", playAgain)]}>
              Find new match
            </button>
          </div>
        ) : interrupted ? (
          <div mix={overlayTextStyle}>
            <div mix={lobbySpinnerStyle} aria-hidden="true" />
            <div mix={overlayBig}>
              {interrupted === "self" ? "Connection lost" : "Opponent disconnected"}
            </div>
            <div mix={overlayMuted}>
              {interrupted === "self"
                ? "Reconnecting… your game is held."
                : "Waiting for them to reconnect…"}
            </div>
          </div>
        ) : countdown !== null ? (
          <div mix={overlayTextStyle}>
            <div key={String(countdown)} mix={countdownStyle}>
              {countdown === "go" ? "Start!" : countdown}
            </div>
          </div>
        ) : undefined;

      return (
        <div mix={wrapStyle}>
          <div mix={arenaStyle}>
            <div mix={mainColStyle}>
              <div mix={nameTagStyle}>You</div>
              <GameView state={state} elapsedMs={elapsedMs} overlay={overlay} showTimer={false} />
            </div>
            <div mix={oppColStyle}>
              <div mix={nameTagStyle}>{opponentName}</div>
              <OpponentBoard cells={opponentCells} lines={opponentLines} />
            </div>
          </div>
          <MobileControls
            disabled={!canUseControls}
            onPressLeft={() => input.pressLeft()}
            onReleaseLeft={() => input.releaseLeft()}
            onPressRight={() => input.pressRight()}
            onReleaseRight={() => input.releaseRight()}
            onPressUp={() => input.pressSoftDrop()}
            onReleaseUp={() => input.releaseSoftDrop()}
            onDown={() => input.tapRotateCW()}
            onA={() => input.tapHardDrop()}
            onB={() => input.tapHold()}
          />
          <p mix={helpStyle}>
            ← → move · ↓ soft drop · ↑/X rotate · Z rotate ccw · Space hard drop · C hold
          </p>
          {canSurrender ? (
            <div mix={controlsStyle}>
              <button type="button" mix={[surrenderBtnStyle, on("click", surrender)]}>
                Surrender
              </button>
            </div>
          ) : null}
        </div>
      );
    };
  },
);

// Read-only mirror of the opponent's board. Reuses the shared Board renderer;
// garbage cells already render gray via colorForValue.
function OpponentBoard(handle: Handle<{ cells: number[] | null; lines: number }>) {
  return () => {
    let { cells, lines } = handle.props;
    if (!cells) {
      return <div mix={oppPlaceholderStyle}>Waiting…</div>;
    }
    let boardCells: BoardCell[] = cells.map((v) => ({ v, ghost: false }));
    return (
      <div mix={oppMirrorStyle}>
        <Board cells={boardCells} activeColor="transparent" />
        <div mix={oppLinesStyle}>{lines} lines</div>
      </div>
    );
  };
}

function Lobby(handle: Handle<{ title: string; subtitle: string }>) {
  return () => (
    <div mix={lobbyStyle}>
      <div mix={lobbySpinnerStyle} aria-hidden="true" />
      <div mix={lobbyTitleStyle}>{handle.props.title}</div>
      <div mix={lobbySubStyle}>{handle.props.subtitle}</div>
    </div>
  );
}

const wrapStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  "@media (max-width: 1024px)": {
    minHeight: "calc(100dvh - 120px)",
    gap: "10px",
  },
});
const arenaStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(120px, 200px)",
  gap: "24px",
  alignItems: "start",
  // On mobile the rival board is hidden and the player's board goes fullscreen,
  // matching the single-player modes: become a flex column so the board fills.
  "@media (max-width: 1024px)": {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    gap: 0,
  },
});
const mainColStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  "@media (max-width: 1024px)": { flex: 1, gap: 0, width: "100%" },
});
const oppColStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  "@media (max-width: 1024px)": { display: "none" },
});
const nameTagStyle = css({
  fontSize: "11px",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--muted, #8b949e)",
  fontWeight: 700,
  "@media (max-width: 1024px)": { display: "none" },
});
const oppMirrorStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  "@media (max-width: 1024px)": {
    display: "grid",
    gridTemplateColumns: "92px minmax(0, 1fr)",
    alignItems: "center",
    gap: "12px",
  },
});
const oppLinesStyle = css({
  fontSize: "12px",
  color: "var(--muted, #8b949e)",
  fontVariantNumeric: "tabular-nums",
  textAlign: "center",
  "@media (max-width: 1024px)": { textAlign: "left" },
});
const oppPlaceholderStyle = css({
  aspectRatio: `${COLS} / ${ROWS}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "12px",
  color: "var(--muted, #8b949e)",
  border: "var(--border-w, 1px) solid var(--border, #2b333d)",
  borderRadius: "var(--radius-md, 8px)",
  background: "#0a0d12",
  "@media (max-width: 1024px)": { width: "92px" },
});

const helpStyle = css({
  margin: 0,
  textAlign: "center",
  fontSize: "12px",
  color: "var(--muted, #8b949e)",
  "@media (max-width: 1024px)": { display: "none" },
});
const controlsStyle = css({
  display: "flex",
  justifyContent: "center",
  "@media (max-width: 1024px)": { justifyContent: "stretch" },
});
const surrenderBtnStyle = css({
  appearance: "none",
  font: "inherit",
  fontWeight: 700,
  cursor: "pointer",
  border: "var(--border-w, 1px) solid var(--border, #2b333d)",
  borderRadius: "var(--radius-sm, 8px)",
  padding: "8px 18px",
  background: "transparent",
  color: "var(--danger, #ff6b6b)",
  "@media (max-width: 1024px)": { width: "100%", minHeight: "44px" },
});

const overlayTextStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  alignItems: "center",
});
const overlayBig = css({
  fontSize: "34px",
  fontWeight: 700,
  fontFamily: "var(--font-display, var(--font))",
  fontVariantNumeric: "tabular-nums",
});
const winStyle = css({ color: "var(--accent, #2dacf9)" });
const overlayMuted = css({ fontSize: "13px", color: "var(--muted, #8b949e)" });
const resumeBtnStyle = css({
  appearance: "none",
  font: "inherit",
  fontWeight: 700,
  cursor: "pointer",
  border: 0,
  borderRadius: "var(--radius-sm, 8px)",
  padding: "8px 20px",
  background: "var(--accent, #2dacf9)",
  color: "var(--accent-ink, #04121d)",
  boxShadow: "var(--glow, none)",
});
const countdownStyle = css({
  fontSize: "56px",
  fontWeight: 700,
  fontFamily: "var(--font-display, var(--font))",
  fontVariantNumeric: "tabular-nums",
  color: "var(--accent, #2dacf9)",
});

const lobbyStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "14px",
  minHeight: "320px",
  textAlign: "center",
  padding: "32px",
});
const lobbySpinnerStyle = css({
  width: "40px",
  height: "40px",
  borderRadius: "50%",
  border: "3px solid var(--border, #2b333d)",
  borderTopColor: "var(--accent, #2dacf9)",
  animation: "versus-spin 0.8s linear infinite",
  "@keyframes versus-spin": { to: { transform: "rotate(360deg)" } },
});
const lobbyTitleStyle = css({
  fontSize: "20px",
  fontWeight: 700,
  fontFamily: "var(--font-display, var(--font))",
});
const lobbySubStyle = css({ fontSize: "13px", color: "var(--muted, #8b949e)", maxWidth: "320px" });
