// Test helper: plays the real engine with a simple heuristic (same approach as
// tmp/win-bot.ts) to produce a valid winning replay the server will verify.
import {
  COLS,
  ROWS,
  createInitialState,
  step,
  type Action,
  type GameState,
  type RecordedAction,
} from '../app/game/engine.ts'
import { cellsFor, type PieceType, type Rotation } from '../app/game/pieces.ts'

function collidesAt(board: Uint8Array, type: PieceType, rot: Rotation, x: number, y: number) {
  for (let [cx, cy] of cellsFor(type, rot)) {
    let col = x + cx
    let row = y + cy
    if (col < 0 || col >= COLS || row >= ROWS) return true
    if (row >= 0 && board[row * COLS + col] !== 0) return true
  }
  return false
}

// Score a resulting board (higher is better) using El-Tetris-style weights.
function scoreBoard(board: Uint8Array, linesCleared: number): number {
  let heights = new Array(COLS).fill(0)
  let holes = 0
  for (let col = 0; col < COLS; col++) {
    let seen = false
    for (let row = 0; row < ROWS; row++) {
      if (board[row * COLS + col] !== 0) {
        if (!seen) heights[col] = ROWS - row
        seen = true
      } else if (seen) holes++
    }
  }
  let aggHeight = heights.reduce((a, b) => a + b, 0)
  let bump = 0
  for (let i = 0; i < COLS - 1; i++) bump += Math.abs(heights[i] - heights[i + 1])
  return -0.51 * aggHeight + 0.76 * linesCleared - 0.36 * holes - 0.18 * bump
}

function bestPlacement(state: GameState): { rot: Rotation; x: number } {
  let type = state.active!.type
  let best = { rot: 0 as Rotation, x: 0, score: -Infinity }
  for (let rot = 0 as Rotation; rot < 4; rot = (rot + 1) as Rotation) {
    for (let x = -2; x < COLS; x++) {
      if (collidesAt(state.board, type, rot, x, 0)) continue
      let y = 0
      while (!collidesAt(state.board, type, rot, x, y + 1)) y++
      let board = Uint8Array.from(state.board)
      for (let [cx, cy] of cellsFor(type, rot)) {
        let row = y + cy
        if (row >= 0) board[row * COLS + (x + cx)] = type + 1
      }
      let cleared = 0
      for (let row = 0; row < ROWS; row++) {
        let full = true
        for (let col = 0; col < COLS; col++) if (board[row * COLS + col] === 0) full = false
        if (full) cleared++
      }
      let score = scoreBoard(board, cleared)
      if (score > best.score) best = { rot, x, score }
    }
  }
  return { rot: best.rot, x: best.x }
}

export function generateWinningReplay(
  seed: number,
  mode = 'sprint40',
): { seed: number; mode: string; actions: RecordedAction[] } {
  let state = createInitialState(seed, mode)
  let recorded: RecordedAction[] = []
  let guard = 0

  function act(a: Action) {
    recorded.push({ tick: state.tick, action: a })
    step(state, [a])
  }

  while (state.status === 'playing' && guard++ < 5000) {
    let target = bestPlacement(state)
    let cur = state.active!.rotation
    let delta = (target.rot - cur + 4) % 4
    for (let i = 0; i < delta && state.status === 'playing'; i++) act('rotateCW')
    let dx = target.x - state.active!.x
    while (dx < 0 && state.status === 'playing') {
      act('left')
      dx++
    }
    while (dx > 0 && state.status === 'playing') {
      act('right')
      dx--
    }
    if (state.status === 'playing') act('hardDrop')
  }

  if (state.status !== 'won') {
    throw new Error(`win bot failed for seed ${seed}: status=${state.status}`)
  }
  return { seed, mode, actions: recorded }
}
