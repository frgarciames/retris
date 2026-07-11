import type { Handle, RemixNode } from "remix/ui";
import { css } from "remix/ui";

import { ghostY, levelFor, NEXT_QUEUE_SIZE, type GameState } from "../game/engine.ts";
import { isSurvivalMode } from "../game/modes.ts";
import { cellsFor, PIECE_COLORS, type PieceType } from "../game/pieces.ts";
import { formatTime } from "../utils/format.ts";
import { Board, emptyView, PiecePreview, type BoardCell } from "./board.tsx";

// Builds the merged playfield view: settled cells, the hard-drop ghost outline,
// then the active piece painted on top.
function buildCells(state: GameState): BoardCell[] {
  let cells = emptyView();
  for (let i = 0; i < state.board.length; i++) cells[i] = { v: state.board[i]!, ghost: false };

  let active = state.active;
  if (active) {
    let gy = ghostY(state);
    if (gy !== null) {
      for (let [cx, cy] of cellsFor(active.type, active.rotation)) {
        let col = active.x + cx;
        let row = gy + cy;
        if (row >= 0) {
          let idx = row * 10 + col;
          if (cells[idx] && cells[idx]!.v === 0) cells[idx] = { v: 0, ghost: true };
        }
      }
    }
    for (let [cx, cy] of cellsFor(active.type, active.rotation)) {
      let col = active.x + cx;
      let row = active.y + cy;
      if (row >= 0) cells[row * 10 + col] = { v: active.type + 1, ghost: false };
    }
  }
  return cells;
}

export function GameView(
  handle: Handle<{
    state: GameState;
    elapsedMs: number;
    overlay?: RemixNode;
    showTimer?: boolean;
  }>,
) {
  return () => {
    let { state, elapsedMs, overlay, showTimer = true } = handle.props;
    let cells = buildCells(state);
    let activeColor = state.active ? PIECE_COLORS[state.active.type] : "transparent";
    let goal = state.mode.goal.type === "lines" ? state.mode.goal.count : 0;
    let survival = isSurvivalMode(state.mode);
    let currentLevel = survival ? levelFor(state) : 0;
    // The piece coming up next gets its own big tile; the three after it
    // render as the smaller queue.
    let queue = state.queue.slice(0, NEXT_QUEUE_SIZE + 1) as PieceType[];
    let nextUp = queue.length > 0 ? queue[0]! : null;
    let upcoming = queue.slice(1);

    return (
      <div mix={layoutStyle}>
        <aside mix={sideStyle}>
          <Panel label="Hold">
            <PiecePreview type={state.hold} />
          </Panel>
          {showTimer ? (
            <Panel label="Time">
              <div mix={statBig}>{formatTime(elapsedMs)}</div>
            </Panel>
          ) : null}
          {survival ? (
            <Panel label="Level">
              <div mix={statBig}>{currentLevel}</div>
            </Panel>
          ) : null}
        </aside>

        <div mix={boardWrapStyle}>
          <Board cells={cells} activeColor={activeColor} />

          {overlay ? <div mix={overlayStyle}>{overlay}</div> : null}
        </div>

        <aside mix={sideStyle}>
          <Panel label="Next">
            <div mix={nextUpBoxStyle}>
              <PiecePreview type={nextUp} size="lg" />
            </div>
          </Panel>
          <div mix={queuePanelStyle}>
            <Panel label="Queue">
              <div mix={nextListStyle}>
                {upcoming.map((t, i) => (
                  <PiecePreview key={i} type={t} />
                ))}
              </div>
            </Panel>
          </div>
          <Panel label="Lines">
            <div mix={statBig}>
              {state.linesCleared}
              {goal > 0 ? <span mix={statMuted}> / {goal}</span> : null}
            </div>
          </Panel>
        </aside>
      </div>
    );
  };
}

function Panel(handle: Handle<{ label: string; children?: RemixNode }>) {
  return () => (
    <section mix={panelStyle}>
      <h2 mix={panelLabelStyle}>{handle.props.label}</h2>
      {handle.props.children}
    </section>
  );
}

const layoutStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(96px, 1fr) minmax(220px, 320px) minmax(96px, 1fr)",
  gap: "20px",
  alignItems: "start",
  justifyContent: "center",
  "@media (max-width: 640px)": {
    flex: 1,
    position: "relative",
    gridTemplateColumns: "1fr",
    gridTemplateRows: "1fr",
    gap: 0,
    "& > *": { gridColumn: "1 / -1", gridRow: "1 / -1" },
    "& > *:nth-child(1)": { justifySelf: "start" },
    "& > *:nth-child(3)": { justifySelf: "end" },
  },
});

const sideStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  "@media (max-width: 640px)": {
    gap: "8px",
    width: "84px",
    alignSelf: "start",
    zIndex: 2,
  },
});

const boardWrapStyle = css({
  position: "relative",
  width: "100%",
  "@media (max-width: 640px)": {
    zIndex: 1,
    // Size the playfield by available height (capped at full width) so the
    // board plus the touch controls fit on screen without scrolling. The
    // width follows from the 10:20 aspect ratio.
    width: "auto",
    // height: 'min(calc((100vw - 32px) * 2), calc(100dvh - 430px))',
    height: "100%",
    aspectRatio: "10 / 20",
    justifySelf: "center",
  },
});

const overlayStyle = css({
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  background: "rgba(8,11,16,0.82)",
  borderRadius: "var(--radius-md, 8px)",
  padding: "16px",
  zIndex: 3,
  "@media (max-width: 640px)": { padding: "12px" },
});

const panelStyle = css({
  background: "var(--panel, #161b22)",
  border: "var(--border-w, 1px) solid var(--border, #2b333d)",
  borderRadius: "var(--radius-lg, 10px)",
  boxShadow: "var(--shadow-panel, none)",
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  "@media (max-width: 640px)": {
    padding: "8px",
    gap: "6px",
    background: "rgba(22, 27, 34, 0.56)",
    backdropFilter: "blur(8px)",
  },
});

const panelLabelStyle = css({
  margin: 0,
  fontSize: "11px",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--muted, #8b949e)",
  "@media (max-width: 640px)": { fontSize: "9px" },
});

const nextListStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  "@media (max-width: 640px)": {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: "8px",
  },
});

const queuePanelStyle = css({
  "@media (max-width: 640px)": { display: "none" },
});

// Square tile for the single up-next piece.
const nextUpBoxStyle = css({
  aspectRatio: "1 / 1",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px",
  background: "var(--panel-2, #1f2630)",
  border: "var(--border-w, 1px) solid var(--border, #2b333d)",
  borderRadius: "var(--radius-md, 8px)",
  "@media (max-width: 640px)": { padding: "8px" },
});
const statBig = css({
  fontSize: "22px",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  "@media (max-width: 640px)": { fontSize: "14px" },
});
const statMuted = css({ color: "var(--muted, #8b949e)", fontWeight: 400, fontSize: "15px" });
