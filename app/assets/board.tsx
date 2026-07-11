import type { Handle } from "remix/ui";
import { css } from "remix/ui";

import { COLS, GARBAGE_VALUE, ROWS } from "../game/engine.ts";
import { cellsFor, PIECE_COLORS, type PieceType } from "../game/pieces.ts";

// Gray fill for garbage rows sent by a 1v1 opponent.
const GARBAGE_COLOR = "#6b7280";

// One playfield cell as the UI sees it. `v` is the stored board value
// (0 = empty, else PieceType + 1); `ghost` marks the hard-drop landing outline.
export interface BoardCell {
  v: number;
  ghost: boolean;
}

export function colorForValue(v: number): string {
  if (v === GARBAGE_VALUE) return GARBAGE_COLOR;
  return PIECE_COLORS[(v - 1) as PieceType];
}

// Build an empty view grid the live/replay components fill each frame.
export function emptyView(): BoardCell[] {
  return Array.from({ length: COLS * ROWS }, () => ({ v: 0, ghost: false }));
}

// Pure playfield renderer shared by the live game and the replay viewer.
export function Board(handle: Handle<{ cells: BoardCell[]; activeColor: string }>) {
  return () => {
    let { cells, activeColor } = handle.props;
    return (
      <div mix={boardStyle}>
        {cells.map((cell, i) => {
          let style: Record<string, string> = {};
          if (cell.v > 0) {
            style.background = colorForValue(cell.v);
            style.borderColor = "rgba(0,0,0,0.35)";
          } else if (cell.ghost) {
            style.borderColor = activeColor;
            style.background = "transparent";
          }
          return <div key={i} mix={cellStyle} style={style} />;
        })}
      </div>
    );
  };
}

const boardStyle = css({
  display: "grid",
  gridTemplateColumns: `repeat(${COLS}, 1fr)`,
  gridTemplateRows: `repeat(${ROWS}, 1fr)`,
  width: "100%",
  aspectRatio: `${COLS} / ${ROWS}`,
  gap: "1px",
  padding: "6px",
  background: "#0a0d12",
  border: "var(--border-w, 1px) solid var(--border, #2b333d)",
  borderRadius: "var(--radius-md, 8px)",
  boxShadow: "var(--shadow-panel, none)",
  // On mobile the wrapper is sized by height; the board fills it and the
  // 10:20 aspect ratio drives the width.
  "@media (max-width: 640px)": { padding: "4px", height: "100%", width: "auto" },
});

const cellStyle = css({
  width: "100%",
  height: "100%",
  borderRadius: "var(--radius-cell, 2px)",
  border: "1px solid transparent",
  background: "rgba(255,255,255,0.03)",
});

// A 4x2 preview of a single tetromino in its spawn orientation, used for the
// hold slot and the next-piece queue. `size="lg"` is the big up-next tile.
export function PiecePreview(handle: Handle<{ type: PieceType | null; size?: "sm" | "lg" }>) {
  return () => {
    let { type, size } = handle.props;
    let filled = new Set<number>();
    if (type !== null) {
      for (let [cx, cy] of cellsFor(type, 0)) filled.add(cy * 4 + cx);
    }
    let color = type !== null ? PIECE_COLORS[type] : "transparent";
    return (
      <div mix={size === "lg" ? [previewStyle, previewLgStyle] : previewStyle}>
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            mix={previewCellStyle}
            style={{ background: filled.has(i) ? color : "transparent" }}
          />
        ))}
      </div>
    );
  };
}

const previewStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gridTemplateRows: "repeat(2, 1fr)",
  gap: "2px",
  width: "72px",
  aspectRatio: "2 / 1",
  "@media (max-width: 640px)": { width: "60px" },
});

const previewLgStyle = css({
  width: "100%",
  maxWidth: "116px",
  gap: "3px",
});

const previewCellStyle = css({
  width: "100%",
  height: "100%",
  borderRadius: "var(--radius-cell, 2px)",
});
