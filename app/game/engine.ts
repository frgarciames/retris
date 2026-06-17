// Deterministic, DOM-free Tetris-style engine.
//
// The same module runs in three places: the browser (live play), the server
// (re-simulating a submitted replay to derive the canonical time), and the
// replay viewer (playback). It advances in fixed ticks; given a seed and the
// per-tick input list it always produces the same result, so the leaderboard
// time is computed, never trusted from the client.

import { getMode, type GameMode } from './modes.ts'
import {
  cellsFor,
  kicksFor,
  PIECE_COUNT,
  type PieceType,
  type Rotation,
} from './pieces.ts'
import { createRng, makeBag, type Rng } from './rng.ts'

export const COLS = 10
export const ROWS = 20

// Stored board value for a garbage (gray) cell pushed in from a 1v1 opponent.
// Settled pieces store PieceType+1 (1..7), so 8 is unambiguous and never
// produced by normal play.
export const GARBAGE_VALUE = 8

// Fixed timestep. Time is derived from ticks so it is identical on every replay.
export const TICKS_PER_SECOND = 60
export const MS_PER_TICK = 1000 / TICKS_PER_SECOND

// How many ticks between automatic gravity drops, and how long a grounded piece
// waits before locking. Tuned for sprint play where drops are mostly manual.
const GRAVITY_TICKS = 48
const LOCK_DELAY_TICKS = 30
const SPAWN_X = 3
const SPAWN_Y = 0
// Upcoming pieces shown to the player.
export const NEXT_QUEUE_SIZE = 3

export type Action =
  | 'left'
  | 'right'
  | 'rotateCW'
  | 'rotateCCW'
  | 'softDrop'
  | 'hardDrop'
  | 'hold'

export interface RecordedAction {
  tick: number
  action: Action
}

export interface ActivePiece {
  type: PieceType
  rotation: Rotation
  x: number
  y: number
}

export type GameStatus = 'playing' | 'won' | 'gameover'

export interface GameState {
  board: Uint8Array // length ROWS*COLS, 0 = empty else PieceType+1
  rng: Rng
  queue: number[] // upcoming piece types
  active: ActivePiece | null
  hold: PieceType | null
  canHold: boolean
  tick: number
  linesCleared: number
  status: GameStatus
  finishedTick: number | null
  mode: GameMode
  gravityCounter: number
  lockCounter: number
}

function refillQueue(state: GameState): void {
  // Keep enough pieces buffered to show the preview and never run dry.
  while (state.queue.length <= NEXT_QUEUE_SIZE + 1) {
    state.queue.push(...makeBag(state.rng))
  }
}

function spawnPiece(type: PieceType): ActivePiece {
  return { type, rotation: 0, x: SPAWN_X, y: SPAWN_Y }
}

function collides(board: Uint8Array, piece: ActivePiece): boolean {
  for (let [cx, cy] of cellsFor(piece.type, piece.rotation)) {
    let col = piece.x + cx
    let row = piece.y + cy
    if (col < 0 || col >= COLS || row >= ROWS) return true
    if (row >= 0 && board[row * COLS + col] !== 0) return true
  }
  return false
}

export function createInitialState(seed: number, modeId: string): GameState {
  let mode = getMode(modeId)
  if (!mode) throw new Error(`Unknown game mode: ${modeId}`)

  let state: GameState = {
    board: new Uint8Array(ROWS * COLS),
    rng: createRng(seed),
    queue: [],
    active: null,
    hold: null,
    canHold: true,
    tick: 0,
    linesCleared: 0,
    status: 'playing',
    finishedTick: null,
    mode,
    gravityCounter: 0,
    lockCounter: 0,
  }
  refillQueue(state)
  state.active = spawnPiece(nextType(state))
  return state
}

function nextType(state: GameState): PieceType {
  refillQueue(state)
  return state.queue.shift() as PieceType
}

function tryMove(state: GameState, dx: number, dy: number): boolean {
  let active = state.active
  if (!active) return false
  let moved = { ...active, x: active.x + dx, y: active.y + dy }
  if (collides(state.board, moved)) return false
  state.active = moved
  return true
}

function tryRotate(state: GameState, dir: 1 | -1): boolean {
  let active = state.active
  if (!active) return false
  let from = active.rotation
  let to = (((from + dir) % 4) + 4) % 4 as Rotation
  for (let [dx, dy] of kicksFor(active.type, from, to)) {
    let candidate = { ...active, rotation: to, x: active.x + dx, y: active.y + dy }
    if (!collides(state.board, candidate)) {
      state.active = candidate
      return true
    }
  }
  return false
}

function isGrounded(state: GameState): boolean {
  let active = state.active
  if (!active) return false
  return collides(state.board, { ...active, y: active.y + 1 })
}

function clearLines(state: GameState): number {
  let board = state.board
  let writeRow = ROWS - 1
  let cleared = 0
  for (let readRow = ROWS - 1; readRow >= 0; readRow--) {
    let full = true
    for (let col = 0; col < COLS; col++) {
      if (board[readRow * COLS + col] === 0) {
        full = false
        break
      }
    }
    if (full) {
      cleared++
      continue
    }
    if (writeRow !== readRow) {
      board.copyWithin(writeRow * COLS, readRow * COLS, readRow * COLS + COLS)
    }
    writeRow--
  }
  // Zero out the rows above the compacted stack.
  for (let row = writeRow; row >= 0; row--) {
    board.fill(0, row * COLS, row * COLS + COLS)
  }
  return cleared
}

// Apply incoming 1v1 garbage immediately: shift the settled stack up and insert
// gray rows at the bottom, each with a single gap, so the line a player clears
// shows up on the opponent's board the instant it is sent (not on their next
// lock). Each entry in `holeColumns` is the gap column for one gray row.
//
// The hole columns are supplied by the caller (generated client-side) and are
// deliberately kept out of the seeded RNG (`state.rng`) so both players keep an
// identical piece sequence no matter how much garbage each receives.
export function applyGarbageNow(state: GameState, holeColumns: readonly number[]): void {
  let rows = holeColumns.length
  if (rows === 0 || state.status !== 'playing') return

  let board = state.board
  // Anything settled in the top `rows` rows would be pushed off the top of the
  // playfield: that is a top-out.
  for (let i = 0; i < rows * COLS && i < board.length; i++) {
    if (board[i] !== 0) {
      state.status = 'gameover'
      state.finishedTick = state.tick
      return
    }
  }

  // Move the existing stack up by `rows` rows, then fill the freed bottom rows
  // with gray cells, leaving one gap per row at its hole column.
  board.copyWithin(0, rows * COLS)
  for (let r = 0; r < rows; r++) {
    let row = ROWS - rows + r
    let hole = ((holeColumns[r]! % COLS) + COLS) % COLS
    for (let col = 0; col < COLS; col++) {
      board[row * COLS + col] = col === hole ? 0 : GARBAGE_VALUE
    }
  }

  // The risen stack may now overlap the active piece; nudge it up just enough to
  // clear. If it cannot fit even at the ceiling, the board has topped out.
  let active = state.active
  if (active && collides(board, active)) {
    let lifted = { ...active }
    while (collides(board, lifted) && lifted.y > -ROWS) lifted.y--
    if (collides(board, lifted)) {
      state.status = 'gameover'
      state.finishedTick = state.tick
      return
    }
    state.active = lifted
    state.gravityCounter = 0
    state.lockCounter = 0
  }
}

function goalMet(state: GameState): boolean {
  let goal = state.mode.goal
  if (goal.type === 'lines') return state.linesCleared >= goal.count
  return false
}

function lockPiece(state: GameState): void {
  let active = state.active
  if (!active) return
  let value = active.type + 1
  for (let [cx, cy] of cellsFor(active.type, active.rotation)) {
    let col = active.x + cx
    let row = active.y + cy
    if (row >= 0) state.board[row * COLS + col] = value
  }

  state.linesCleared += clearLines(state)
  state.active = null
  state.canHold = true
  state.gravityCounter = 0
  state.lockCounter = 0

  if (goalMet(state)) {
    state.status = 'won'
    state.finishedTick = state.tick
    return
  }

  let next = spawnPiece(nextType(state))
  if (collides(state.board, next)) {
    state.status = 'gameover'
    state.finishedTick = state.tick
    return
  }
  state.active = next
}

function applyAction(state: GameState, action: Action): boolean {
  switch (action) {
    case 'left':
      return tryMove(state, -1, 0)
    case 'right':
      return tryMove(state, 1, 0)
    case 'rotateCW':
      return tryRotate(state, 1)
    case 'rotateCCW':
      return tryRotate(state, -1)
    case 'softDrop':
      if (tryMove(state, 0, 1)) {
        state.gravityCounter = 0
        return true
      }
      return false
    case 'hardDrop': {
      while (tryMove(state, 0, 1)) {
        /* fall to the bottom */
      }
      lockPiece(state)
      return true
    }
    case 'hold':
      return applyHold(state)
  }
}

function applyHold(state: GameState): boolean {
  if (!state.canHold || !state.active) return false
  let current = state.active.type
  let swapIn = state.hold
  state.hold = current
  if (swapIn == null) {
    state.active = spawnPiece(nextType(state))
  } else {
    state.active = spawnPiece(swapIn)
  }
  state.canHold = false
  // A hold should not place a piece into an occupied spawn; if it does, the
  // board has topped out.
  if (collides(state.board, state.active)) {
    state.status = 'gameover'
    state.finishedTick = state.tick
  }
  return true
}

// Advance exactly one tick, applying the inputs recorded for this tick.
export function step(state: GameState, actions: readonly Action[] = []): GameState {
  if (state.status !== 'playing') return state

  for (let action of actions) {
    if (state.status !== 'playing') break
    let lockedByHardDrop = action === 'hardDrop'
    let progressed = applyAction(state, action)
    // A successful horizontal move or rotation while grounded refreshes the
    // lock delay (classic SRS behavior).
    if (progressed && !lockedByHardDrop && (action === 'left' || action === 'right' || action === 'rotateCW' || action === 'rotateCCW')) {
      if (isGrounded(state)) state.lockCounter = 0
    }
  }

  if (state.status === 'playing' && state.active) {
    state.gravityCounter++
    if (state.gravityCounter >= GRAVITY_TICKS) {
      state.gravityCounter = 0
      tryMove(state, 0, 1)
    }
    if (isGrounded(state)) {
      state.lockCounter++
      if (state.lockCounter >= LOCK_DELAY_TICKS) {
        lockPiece(state)
      }
    } else {
      state.lockCounter = 0
    }
  }

  state.tick++
  return state
}

export interface SimulationResult {
  won: boolean
  status: GameStatus
  durationMs: number
  linesCleared: number
  finalTick: number
}

// Default safety cap: a 40-line sprint should finish well within ten minutes of
// game time even for a slow run.
const DEFAULT_MAX_TICKS = TICKS_PER_SECOND * 60 * 10

// Re-run a recorded game to completion. Used by the server to verify a replay
// and compute the authoritative duration and line count.
export function simulate(
  seed: number,
  modeId: string,
  recorded: readonly RecordedAction[],
  maxTicks: number = DEFAULT_MAX_TICKS,
): SimulationResult {
  let state = createInitialState(seed, modeId)

  let byTick = new Map<number, Action[]>()
  for (let { tick, action } of recorded) {
    let list = byTick.get(tick)
    if (list) list.push(action)
    else byTick.set(tick, [action])
  }

  while (state.status === 'playing' && state.tick < maxTicks) {
    step(state, byTick.get(state.tick) ?? [])
  }

  let finalTick = state.finishedTick ?? state.tick
  return {
    won: state.status === 'won',
    status: state.status,
    durationMs: Math.round(finalTick * MS_PER_TICK),
    linesCleared: state.linesCleared,
    finalTick,
  }
}

// Row the active piece would land on if hard-dropped now — used by the UI to
// draw the ghost piece. Returns the piece's y after dropping.
export function ghostY(state: GameState): number | null {
  let active = state.active
  if (!active) return null
  let y = active.y
  while (!collides(state.board, { ...active, y: y + 1 })) y++
  return y
}

export { PIECE_COUNT }
export type { PieceType, Rotation }
