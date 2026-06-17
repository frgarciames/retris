import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

import { createInitialState, MS_PER_TICK, type GameState } from '../game/engine.ts'
import {
  advanceVersus,
  buildTimeline,
  safeParseGarbage,
  safeParseRecorded,
} from '../game/versus-replay.ts'
import { GameView } from './game-view.tsx'

interface VersusReplayProps extends SerializableProps {
  seed: number
  mode: string
  winnerName: string
  loserName: string
  winnerActions: string
  winnerGarbage: string
  loserActions: string
  loserGarbage: string
}

// Plays a stored 1v1 match back board-for-board: both sides advance in lockstep
// off the same shared seed, each replaying its own recorded inputs and received
// garbage. One play/pause + scrubber drives both at once.
export const VersusReplay = clientEntry(
  import.meta.url,
  function VersusReplay(handle: Handle<VersusReplayProps>) {
    let p = handle.props
    let winnerTimeline = buildTimeline({
      seed: p.seed,
      mode: p.mode,
      actions: safeParseRecorded(p.winnerActions),
      garbage: safeParseGarbage(p.winnerGarbage),
    })
    let loserTimeline = buildTimeline({
      seed: p.seed,
      mode: p.mode,
      actions: safeParseRecorded(p.loserActions),
      garbage: safeParseGarbage(p.loserGarbage),
    })
    let finalTick = Math.max(winnerTimeline.finalTick, loserTimeline.finalTick)

    let winnerState: GameState = createInitialState(p.seed, p.mode)
    let loserState: GameState = createInitialState(p.seed, p.mode)
    let tick = 0
    let playing = false

    function advanceOne(): boolean {
      if (tick >= finalTick) return false
      advanceVersus(winnerState, winnerTimeline)
      advanceVersus(loserState, loserTimeline)
      tick++
      return true
    }

    function rebuildTo(target: number) {
      winnerState = createInitialState(p.seed, p.mode)
      loserState = createInitialState(p.seed, p.mode)
      tick = 0
      while (tick < target) advanceOne()
    }

    function seek(target: number) {
      let clamped = Math.max(0, Math.min(finalTick, target))
      if (clamped < tick) rebuildTo(clamped)
      else while (tick < clamped && advanceOne()) {}
      handle.update()
    }

    // ----- playback loop -----
    let rafId = 0
    let lastTime = 0
    let acc = 0

    function frame(now: number) {
      acc += now - lastTime
      lastTime = now
      if (acc > 250) acc = 250
      let advanced = false
      while (acc >= MS_PER_TICK) {
        acc -= MS_PER_TICK
        if (!advanceOne()) {
          playing = false
          break
        }
        advanced = true
      }
      if (advanced || !playing) handle.update()
      if (playing) rafId = requestAnimationFrame(frame)
    }

    function startLoop() {
      if (playing) return
      if (tick >= finalTick) rebuildTo(0)
      playing = true
      lastTime = performance.now()
      acc = 0
      rafId = requestAnimationFrame(frame)
    }

    function stopLoop() {
      playing = false
      cancelAnimationFrame(rafId)
    }

    function togglePlay() {
      if (playing) stopLoop()
      else startLoop()
      handle.update()
    }

    if (typeof window !== 'undefined' && typeof requestAnimationFrame !== 'undefined') {
      handle.signal.addEventListener('abort', () => cancelAnimationFrame(rafId))
    }

    return () => {
      let atEnd = tick >= finalTick
      let elapsedMs = tick * MS_PER_TICK
      return (
        <div mix={wrapStyle}>
          <div mix={boardsStyle}>
            <div mix={colStyle}>
              <div mix={nameTagStyle}>{p.winnerName} · winner</div>
              <GameView state={winnerState} elapsedMs={elapsedMs} showTimer={false} />
            </div>
            <div mix={colStyle}>
              <div mix={nameTagStyle}>{p.loserName}</div>
              <GameView state={loserState} elapsedMs={elapsedMs} showTimer={false} />
            </div>
          </div>
          <div mix={controlsStyle}>
            <button type="button" mix={[btnStyle, on('click', togglePlay)]}>
              {playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
            </button>
            <input
              type="range"
              min={0}
              max={finalTick}
              value={tick}
              mix={[
                rangeStyle,
                on('input', (event) => {
                  stopLoop()
                  seek(Number((event.currentTarget as HTMLInputElement).value))
                }),
              ]}
            />
          </div>
        </div>
      )
    }
  },
)

const wrapStyle = css({ display: 'flex', flexDirection: 'column', gap: '16px' })
const boardsStyle = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '24px',
  alignItems: 'start',
  '@media (max-width: 720px)': { gridTemplateColumns: '1fr' },
})
const colStyle = css({ display: 'flex', flexDirection: 'column', gap: '10px' })
const nameTagStyle = css({
  fontSize: '11px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--muted, #8b949e)',
  fontWeight: 700,
})
const controlsStyle = css({ display: 'flex', alignItems: 'center', gap: '14px' })
const btnStyle = css({
  appearance: 'none',
  font: 'inherit',
  fontWeight: 700,
  cursor: 'pointer',
  border: 'var(--border-w, 1px) solid var(--border, #2b333d)',
  borderRadius: 'var(--radius-sm, 8px)',
  padding: '8px 16px',
  background: 'var(--panel-2, #1f2630)',
  color: 'var(--text, #e6edf3)',
  minWidth: '90px',
})
const rangeStyle = css({ flex: 1, accentColor: 'var(--accent, #2dacf9)' })
