// Test helper: hard-drop pieces until top-out for classic/survival verification.
import {
  createInitialState,
  levelFor,
  step,
  type RecordedAction,
} from '../app/game/engine.ts'

export function generateGameoverReplay(
  seed: number,
  mode = 'classic',
): {
  seed: number
  mode: string
  actions: RecordedAction[]
  level: number
  duration_ms: number
} {
  let state = createInitialState(seed, mode)
  let recorded: RecordedAction[] = []
  let guard = 0

  while (state.status === 'playing' && guard++ < 50_000) {
    recorded.push({ tick: state.tick, action: 'hardDrop' })
    step(state, ['hardDrop'])
  }

  if (state.status !== 'gameover') {
    throw new Error(`gameover bot failed for seed ${seed}: status=${state.status}`)
  }

  let finalTick = state.finishedTick ?? state.tick
  return {
    seed,
    mode,
    actions: recorded,
    level: levelFor(state),
    duration_ms: Math.round(finalTick * (1000 / 60)),
  }
}
