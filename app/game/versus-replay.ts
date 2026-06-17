// Deterministic playback for 1v1 games.
//
// A versus board is fully reproducible from the shared seed plus two recorded
// streams: the player's inputs (`actions`, same shape as single-player) and the
// garbage rows they received (`garbage`, the gap columns and the tick each
// batch landed on). Replaying both at their recorded ticks rebuilds the exact
// board — used both to resume a dropped connection and to play stored replays.
// DOM-free, like the rest of `app/game`.

import {
  applyGarbageNow,
  createInitialState,
  step,
  type Action,
  type GameState,
  type RecordedAction,
} from './engine.ts'

export interface RecordedGarbage {
  tick: number
  holes: number[]
}

export interface VersusRecording {
  seed: number
  mode: string
  actions: RecordedAction[]
  garbage: RecordedGarbage[]
}

export interface VersusTimeline {
  seed: number
  mode: string
  actionsByTick: Map<number, Action[]>
  garbageByTick: Map<number, number[]>
  finalTick: number
}

export function buildTimeline(recording: VersusRecording): VersusTimeline {
  let actionsByTick = new Map<number, Action[]>()
  let garbageByTick = new Map<number, number[]>()
  let finalTick = 0

  for (let { tick, action } of recording.actions) {
    let list = actionsByTick.get(tick)
    if (list) list.push(action)
    else actionsByTick.set(tick, [action])
    if (tick > finalTick) finalTick = tick
  }
  for (let { tick, holes } of recording.garbage) {
    let list = garbageByTick.get(tick)
    if (list) list.push(...holes)
    else garbageByTick.set(tick, [...holes])
    if (tick > finalTick) finalTick = tick
  }

  return { seed: recording.seed, mode: recording.mode, actionsByTick, garbageByTick, finalTick }
}

// Advance exactly one tick: apply garbage scheduled for this tick first (it was
// recorded at the tick it landed), then the recorded inputs. Mirrors the live
// loop's ordering so reconstruction is bit-identical.
export function advanceVersus(state: GameState, timeline: VersusTimeline): void {
  if (state.status !== 'playing') return
  let holes = timeline.garbageByTick.get(state.tick)
  if (holes && holes.length > 0) applyGarbageNow(state, holes)
  step(state, timeline.actionsByTick.get(state.tick) ?? [])
}

// Rebuild a game's state by replaying its timeline up to `toTick`.
export function reconstructVersus(timeline: VersusTimeline, toTick: number): GameState {
  let state = createInitialState(timeline.seed, timeline.mode)
  while (state.tick < toTick && state.status === 'playing') advanceVersus(state, timeline)
  return state
}

export function safeParseRecorded(json: string | null | undefined): RecordedAction[] {
  if (!json) return []
  try {
    let value = JSON.parse(json)
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

export function safeParseGarbage(json: string | null | undefined): RecordedGarbage[] {
  if (!json) return []
  try {
    let value = JSON.parse(json)
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}
