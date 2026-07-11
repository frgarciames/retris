import { clientEntry, css, on, type Handle, type SerializableProps } from "remix/ui";

import {
  createInitialState,
  MS_PER_TICK,
  simulate,
  step,
  type Action,
  type GameState,
  type RecordedAction,
} from "../game/engine.ts";
import { GameView } from "./game-view.tsx";

interface ReplayPlayerProps extends SerializableProps {
  seed: number;
  mode: string;
  actionsJson: string;
}

export const ReplayPlayer = clientEntry(
  import.meta.url,
  function ReplayPlayer(handle: Handle<ReplayPlayerProps>) {
    let { seed, mode, actionsJson } = handle.props;

    let recorded: RecordedAction[] = safeParse(actionsJson);
    let byTick = new Map<number, Action[]>();
    for (let { tick, action } of recorded) {
      let list = byTick.get(tick);
      if (list) list.push(action);
      else byTick.set(tick, [action]);
    }
    let finalTick = simulate(seed, mode, recorded).finalTick;

    let state: GameState = createInitialState(seed, mode);
    let playing = false;

    function advanceOne() {
      if (state.tick >= finalTick || state.status !== "playing") return false;
      step(state, byTick.get(state.tick) ?? []);
      return true;
    }

    function rebuildTo(target: number) {
      state = createInitialState(seed, mode);
      while (state.tick < target && state.status === "playing") advanceOne();
    }

    function seek(target: number) {
      let clamped = Math.max(0, Math.min(finalTick, target));
      if (clamped < state.tick) rebuildTo(clamped);
      else while (state.tick < clamped && advanceOne()) {}
      handle.update();
    }

    // ----- playback loop -----
    let rafId = 0;
    let lastTime = 0;
    let acc = 0;

    function frame(now: number) {
      acc += now - lastTime;
      lastTime = now;
      if (acc > 250) acc = 250;
      let advanced = false;
      while (acc >= MS_PER_TICK) {
        acc -= MS_PER_TICK;
        if (!advanceOne()) {
          playing = false;
          break;
        }
        advanced = true;
      }
      if (advanced || !playing) handle.update();
      if (playing) rafId = requestAnimationFrame(frame);
    }

    function startLoop() {
      if (playing) return;
      if (state.tick >= finalTick) rebuildTo(0); // restart from the beginning
      playing = true;
      lastTime = performance.now();
      acc = 0;
      rafId = requestAnimationFrame(frame);
    }

    function stopLoop() {
      playing = false;
      cancelAnimationFrame(rafId);
    }

    function togglePlay() {
      if (playing) {
        stopLoop();
        handle.update();
      } else {
        startLoop();
        handle.update();
      }
    }

    if (typeof window !== "undefined" && typeof requestAnimationFrame !== "undefined") {
      handle.signal.addEventListener("abort", () => cancelAnimationFrame(rafId));
    }

    return () => {
      let elapsedMs = state.tick * MS_PER_TICK;
      let atEnd = state.tick >= finalTick;
      return (
        <div mix={wrapStyle}>
          <GameView state={state} elapsedMs={elapsedMs} />
          <div mix={controlsStyle}>
            <button type="button" mix={[btnStyle, on("click", togglePlay)]}>
              {playing ? "Pause" : atEnd ? "Replay" : "Play"}
            </button>
            <input
              type="range"
              min={0}
              max={finalTick}
              value={state.tick}
              mix={[
                rangeStyle,
                on("input", (event) => {
                  stopLoop();
                  seek(Number((event.currentTarget as HTMLInputElement).value));
                }),
              ]}
            />
          </div>
        </div>
      );
    };
  },
);

function safeParse(json: string): RecordedAction[] {
  try {
    let value = JSON.parse(json);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

const wrapStyle = css({ display: "flex", flexDirection: "column", gap: "16px" });
const controlsStyle = css({ display: "flex", alignItems: "center", gap: "14px" });
const btnStyle = css({
  appearance: "none",
  font: "inherit",
  fontWeight: 700,
  cursor: "pointer",
  border: "var(--border-w, 1px) solid var(--border, #2b333d)",
  borderRadius: "var(--radius-sm, 8px)",
  padding: "8px 16px",
  background: "var(--panel-2, #1f2630)",
  color: "var(--text, #e6edf3)",
  minWidth: "90px",
});
const rangeStyle = css({ flex: 1, accentColor: "var(--accent, #2dacf9)" });
