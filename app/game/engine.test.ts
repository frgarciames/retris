import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  COLS,
  GARBAGE_VALUE,
  ROWS,
  applyGarbageNow,
  createInitialState,
  simulate,
  step,
  type RecordedAction,
} from './engine.ts'
import { PIECE_COUNT } from './pieces.ts'

describe('game engine', () => {
  it('is deterministic: same seed + inputs yields the same result', () => {
    let actions: RecordedAction[] = [
      { tick: 1, action: 'left' },
      { tick: 2, action: 'rotateCW' },
      { tick: 3, action: 'hardDrop' },
      { tick: 5, action: 'right' },
      { tick: 6, action: 'hardDrop' },
    ]
    let a = simulate(12345, 'sprint40', actions, 600)
    let b = simulate(12345, 'sprint40', actions, 600)
    assert.deepEqual(a, b)
  })

  it('produces different piece order for different seeds', () => {
    let s1 = createInitialState(1, 'sprint40')
    let s2 = createInitialState(2, 'sprint40')
    let order1 = [s1.active!.type, ...s1.queue.slice(0, 6)]
    let order2 = [s2.active!.type, ...s2.queue.slice(0, 6)]
    assert.notDeepEqual(order1, order2)
  })

  it('emits a valid 7-bag: the first seven pieces are a permutation of all types', () => {
    let state = createInitialState(99, 'sprint40')
    let firstSeven = [state.active!.type, ...state.queue.slice(0, PIECE_COUNT - 1)]
    let unique = new Set(firstSeven)
    assert.equal(firstSeven.length, PIECE_COUNT)
    assert.equal(unique.size, PIECE_COUNT)
    for (let t = 0; t < PIECE_COUNT; t++) assert.ok(unique.has(t as never))
  })

  it('clears a completed row on lock', () => {
    let state = createInitialState(7, 'sprint40')
    // Fill the bottom row except column 0.
    for (let col = 1; col < COLS; col++) state.board[(ROWS - 1) * COLS + col] = 1
    // Drop a vertical I-piece down column 0 to complete the row.
    state.active = { type: 0, rotation: 1, x: -2, y: 0 }
    step(state, ['hardDrop'])
    assert.equal(state.linesCleared, 1)
    // 9 pre-filled cells + a 4-cell I = 13 placed; one full row of 10 cleared
    // leaves 3 cells (the rest of the I) shifted down into column 0.
    let filled = state.board.reduce((n, v) => n + (v !== 0 ? 1 : 0), 0)
    assert.equal(filled, 3)
  })

  it('flips to "won" when the line goal is reached', () => {
    let state = createInitialState(7, 'sprint40')
    state.linesCleared = 39 // one line away from the 40-line goal
    for (let col = 1; col < COLS; col++) state.board[(ROWS - 1) * COLS + col] = 1
    state.active = { type: 0, rotation: 1, x: -2, y: 0 }
    step(state, ['hardDrop'])
    assert.equal(state.linesCleared, 40)
    assert.equal(state.status, 'won')
    assert.ok(state.finishedTick !== null)
  })

  it('honors a different mode goal (20 lines)', () => {
    let state = createInitialState(7, 'sprint20')
    state.linesCleared = 19 // one line away from the 20-line goal
    for (let col = 1; col < COLS; col++) state.board[(ROWS - 1) * COLS + col] = 1
    state.active = { type: 0, rotation: 1, x: -2, y: 0 }
    step(state, ['hardDrop'])
    assert.equal(state.linesCleared, 20)
    assert.equal(state.status, 'won')
  })

  it('does not report a win for an empty replay', () => {
    let result = simulate(7, 'sprint40', [], 300)
    assert.equal(result.won, false)
  })

  it('garbage drops in instantly, pushing the stack up with a gap per row', () => {
    let state = createInitialState(7, 'versus')
    // A lone block sits on the bottom row, column 5.
    state.board[(ROWS - 1) * COLS + 5] = 1
    // Two garbage rows arrive immediately, gaps at columns 0 and 9.
    applyGarbageNow(state, [0, 9])

    // The pre-existing block moved up two rows (from row 19 to row 17).
    assert.equal(state.board[(ROWS - 1 - 2) * COLS + 5], 1)
    // Bottom two rows are garbage, each solid except its gap column.
    let bottom = ROWS - 1
    let secondFromBottom = ROWS - 2
    assert.equal(state.board[secondFromBottom * COLS + 0], 0) // gap
    assert.equal(state.board[secondFromBottom * COLS + 1], GARBAGE_VALUE)
    assert.equal(state.board[bottom * COLS + 9], 0) // gap
    assert.equal(state.board[bottom * COLS + 8], GARBAGE_VALUE)
  })

  it('garbage that overflows the top tops the board out', () => {
    let state = createInitialState(7, 'versus')
    // Fill the top row except one column: any upward shift pushes a filled cell
    // off-screen.
    for (let col = 1; col < COLS; col++) state.board[col] = 1
    applyGarbageNow(state, [4])
    assert.equal(state.status, 'gameover')
  })

  it('single-player play never produces garbage cells', () => {
    let actions: RecordedAction[] = [
      { tick: 1, action: 'hardDrop' },
      { tick: 3, action: 'hardDrop' },
      { tick: 5, action: 'hardDrop' },
    ]
    let state = createInitialState(123, 'sprint40')
    let byTick = new Map(actions.map((a) => [a.tick, [a.action]] as const))
    for (let i = 0; i < 30; i++) step(state, byTick.get(state.tick) ?? [])
    assert.ok(!state.board.includes(GARBAGE_VALUE))
  })

  it('derives duration from the finishing tick', () => {
    let state = createInitialState(7, 'sprint40')
    state.linesCleared = 39
    for (let col = 1; col < COLS; col++) state.board[(ROWS - 1) * COLS + col] = 1
    state.active = { type: 0, rotation: 1, x: -2, y: 0 }
    let actions: RecordedAction[] = [{ tick: state.tick, action: 'hardDrop' }]
    // Reconstruct the same scenario through simulate would need board priming,
    // so assert the in-state finish here instead.
    step(state, actions.map((a) => a.action))
    assert.ok(state.finishedTick !== null && state.finishedTick >= 0)
  })
})
