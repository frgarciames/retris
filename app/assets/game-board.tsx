import { addEventListeners, clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

import {
  createInitialState,
  MS_PER_TICK,
  step,
  type GameState,
  type RecordedAction,
} from '../game/engine.ts'
import { randomSeed } from '../game/rng.ts'
import { formatTime } from '../utils/format.ts'
import { GameView } from './game-view.tsx'
import { InputController } from './input.ts'
import { MobileControls } from './mobile-controls.tsx'
import { isF4Shortcut, shouldRunF4Shortcut } from './shortcuts.ts'

interface GameBoardProps extends SerializableProps {
  seed: number
  mode: string
  submitHref: string
  // Anonymous players get a sign-in prompt once their finished run is parked
  // server-side; these power the links in that overlay.
  loginHref: string
  signupHref: string
}

export const GameBoard = clientEntry(
  import.meta.url,
  function GameBoard(handle: Handle<GameBoardProps>) {
    // The run in progress can outlive the props that started it: "Try again"
    // restarts with a fresh client-generated seed, and client-side navigation
    // re-renders this same instance with new props (see the reset in render).
    let activeSeed = handle.props.seed
    let activeMode = handle.props.mode
    let runVersion = 0
    let state: GameState = createInitialState(activeSeed, activeMode)
    let recorded: RecordedAction[] = []
    // 'pending' means the server verified and parked the run for an anonymous
    // player; signing in will save it to their account.
    let submitState: 'idle' | 'submitting' | 'pending' | 'error' = 'idle'
    let countdown: number | 'go' | null = 3 // 3 → 2 → 1 → 'go' ("Start!") → null (running)
    // Pausing freezes the tick loop, so the clock (tick * MS_PER_TICK) freezes
    // with it and the recorded replay is unaffected.
    let paused = false

    // Keyboard → per-tick actions (DAS/ARR), all browser-only.
    let input = new InputController()

    // ----- fixed-timestep loop -----
    let rafId = 0
    let lastTime = 0
    let acc = 0
    let countdownTimer = 0

    // Schedules the next countdown step. Deliberately does not call
    // handle.update() synchronously: it runs from setup and from resetGame()
    // (which can run during render), and updating mid-render trips the
    // scheduler's infinite-loop guard. The async timer callback updates.
    function runCountdown() {
      countdownTimer = window.setTimeout(() => {
        if (countdown === 'go') {
          countdown = null
          lastTime = performance.now()
          rafId = requestAnimationFrame(frame)
        } else if (countdown === 1) {
          countdown = 'go'
          runCountdown()
        } else if (typeof countdown === 'number') {
          countdown--
          runCountdown()
        }
        handle.update()
      }, countdown === 'go' ? 500 : 800)
    }

    // Re-initializes everything for a fresh run: "Try again", or new
    // seed/mode props arriving through client-side navigation.
    function resetGame(seed: number, mode: string) {
      cancelAnimationFrame(rafId)
      clearTimeout(countdownTimer)
      runVersion++
      activeSeed = seed
      activeMode = mode
      state = createInitialState(seed, mode)
      recorded = []
      submitState = 'idle'
      paused = false
      input.reset()
      acc = 0
      countdown = 3
      runCountdown()
    }

    function restartGame() {
      resetGame(randomSeed(), activeMode)
      handle.update()
    }

    function togglePause() {
      if (countdown !== null || state.status !== 'playing') return
      paused = !paused
      if (paused) {
        cancelAnimationFrame(rafId)
      } else {
        // Restart the clock from now so the paused stretch is not "caught up".
        lastTime = performance.now()
        acc = 0
        rafId = requestAnimationFrame(frame)
      }
      handle.update()
    }

    function tickOnce() {
      let actions = input.collect()
      let currentTick = state.tick
      for (let action of actions) recorded.push({ tick: currentTick, action })
      step(state, actions)
    }

    function frame(now: number) {
      acc += now - lastTime
      lastTime = now
      // Guard against huge catch-ups after a tab is backgrounded.
      if (acc > 250) acc = 250
      while (acc >= MS_PER_TICK && state.status === 'playing') {
        acc -= MS_PER_TICK
        tickOnce()
      }
      handle.update()
      if (state.status === 'playing') {
        rafId = requestAnimationFrame(frame)
      } else {
        finish()
      }
    }

    async function finish() {
      if (state.status !== 'won') return
      let finishedRunVersion = runVersion
      submitState = 'submitting'
      handle.update()
      try {
        let body = new FormData()
        body.set('seed', String(activeSeed))
        body.set('mode', activeMode)
        body.set('actions', JSON.stringify(recorded))
        let res = await fetch(handle.props.submitHref, { method: 'POST', body })
        if (!res.ok) throw new Error(`submit failed: ${res.status}`)
        let data = (await res.json()) as { href?: string; pending?: boolean }
        if (finishedRunVersion !== runVersion) return
        if (data.href) {
          window.location.assign(data.href)
        } else if (data.pending) {
          submitState = 'pending'
          handle.update()
        } else {
          throw new Error('unexpected submit response')
        }
      } catch {
        if (finishedRunVersion !== runVersion) return
        submitState = 'error'
        handle.update()
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (isF4Shortcut(event.key)) {
        if (shouldRunF4Shortcut(event.key, event.repeat)) restartGame()
        event.preventDefault()
        return
      }
      if (countdown !== null || state.status !== 'playing') return
      if (event.key === 'Escape') {
        if (!event.repeat) togglePause()
        event.preventDefault()
        return
      }
      // While paused, game inputs are ignored (key releases are still tracked
      // by onKeyUp so held keys don't stick across the pause).
      if (paused) return
      if (input.keyDown(event.key, event.repeat)) event.preventDefault()
    }

    function onKeyUp(event: KeyboardEvent) {
      input.keyUp(event.key)
    }

    // Browser-only setup. On the server this component renders the initial board
    // as a static fallback and none of this runs.
    if (typeof window !== 'undefined' && typeof requestAnimationFrame !== 'undefined') {
      addEventListeners(window, handle.signal, {
        keydown: onKeyDown,
        keyup: onKeyUp,
        blur() {
          input.reset()
        },
      })
      runCountdown()
      handle.signal.addEventListener('abort', () => {
        cancelAnimationFrame(rafId)
        clearTimeout(countdownTimer)
      })
    }

    return () => {
      // Client-side navigation re-renders this instance with new props; a
      // changed seed/mode means the page intends a new run.
      if (
        typeof window !== 'undefined' &&
        (handle.props.seed !== activeSeed || handle.props.mode !== activeMode)
      ) {
        resetGame(handle.props.seed, handle.props.mode)
      }

      let elapsedMs = state.tick * MS_PER_TICK
      let canUseControls = countdown === null && state.status === 'playing' && !paused
      let showMobileActions = countdown === null && (state.status === 'playing' || paused)
      let overlay =
        countdown !== null ? (
          <div mix={overlayTextStyle}>
            <div key={String(countdown)} mix={countdownStyle}>
              {countdown === 'go' ? 'Start!' : countdown}
            </div>
          </div>
        ) : paused ? (
          <div mix={overlayTextStyle}>
            <div mix={overlayBig}>Paused</div>
            <button type="button" mix={[resumeBtnStyle, on('click', togglePause)]}>
              Resume
            </button>
            <div mix={overlayMuted}>or press Esc</div>
          </div>
        ) : state.status === 'won' ? (
          <FinishOverlay
            elapsedMs={elapsedMs}
            submitState={submitState}
            loginHref={handle.props.loginHref}
            signupHref={handle.props.signupHref}
          />
        ) : state.status === 'gameover' ? (
          <div mix={overlayTextStyle}>
            <div mix={overlayBig}>Topped out</div>
            <button
              type="button"
              mix={[
                resumeBtnStyle,
                on('click', restartGame),
              ]}
            >
              Try again
            </button>
          </div>
        ) : undefined

      return (
        <div mix={wrapStyle}>
          <GameView state={state} elapsedMs={elapsedMs} overlay={overlay} />
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
          {showMobileActions ? (
            <div mix={mobileActionsStyle}>
              <button type="button" mix={[mobileMetaButtonStyle, on('click', togglePause)]}>
                {paused ? 'Resume' : 'Pause'}
              </button>
              <button type="button" mix={[mobileMetaButtonStyle, on('click', restartGame)]}>
                Restart
              </button>
            </div>
          ) : null}
          <p mix={helpStyle}>
            ← → move · ↓ soft drop · ↑/X rotate · Z rotate ccw · Space hard drop · C hold · Esc pause · F4 restart
          </p>
        </div>
      )
    }
  },
)

function FinishOverlay(
  handle: Handle<{
    elapsedMs: number
    submitState: string
    loginHref: string
    signupHref: string
  }>,
) {
  return () => {
    let { elapsedMs, submitState, loginHref, signupHref } = handle.props
    return (
      <div mix={overlayTextStyle}>
        <div mix={overlayLabel}>Finished</div>
        <div mix={overlayBig}>{formatTime(elapsedMs)}</div>
        {submitState === 'pending' ? (
          <>
            <div mix={overlayMuted}>Sign in to save this run to the leaderboard.</div>
            <div mix={overlayActions}>
              <a href={signupHref} mix={overlayLink}>
                Sign up
              </a>
              <a href={loginHref} mix={overlayLink}>
                Log in
              </a>
            </div>
          </>
        ) : (
          <div mix={overlayMuted}>
            {submitState === 'error' ? 'Could not save run — refresh to retry.' : 'Saving run…'}
          </div>
        )}
      </div>
    )
  }
}

const wrapStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  '@media (max-width: 640px)': {
    minHeight: 'calc(100dvh - 120px)',
    gap: '10px',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
  },
})
const mobileActionsStyle = css({
  display: 'none',
  '@media (max-width: 640px)': {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
  },
})
const mobileMetaButtonStyle = css({
  appearance: 'none',
  minHeight: '44px',
  border: 'var(--border-w, 1px) solid var(--border, #2b333d)',
  borderRadius: 'var(--radius-sm, 8px)',
  background: 'var(--panel, #161b22)',
  color: 'var(--text, #f3f6fb)',
  font: 'inherit',
  fontWeight: 700,
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation',
})
const helpStyle = css({
  margin: 0,
  textAlign: 'center',
  fontSize: '12px',
  color: 'var(--muted, #8b949e)',
  '@media (max-width: 640px)': { display: 'none' },
})
const overlayTextStyle = css({ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' })
const overlayLabel = css({
  fontSize: '12px',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--muted, #8b949e)',
})
const overlayBig = css({
  fontSize: '34px',
  fontWeight: 700,
  fontFamily: 'var(--font-display, var(--font))',
  fontVariantNumeric: 'tabular-nums',
})
const overlayMuted = css({ fontSize: '13px', color: 'var(--muted, #8b949e)' })
const overlayActions = css({ display: 'flex', gap: '16px' })
const resumeBtnStyle = css({
  appearance: 'none',
  font: 'inherit',
  fontWeight: 700,
  cursor: 'pointer',
  border: 0,
  borderRadius: 'var(--radius-sm, 8px)',
  padding: '8px 20px',
  background: 'var(--accent, #2dacf9)',
  color: 'var(--accent-ink, #04121d)',
  boxShadow: 'var(--glow, none)',
})
const countdownStyle = css({
  fontSize: '56px',
  fontWeight: 700,
  fontFamily: 'var(--font-display, var(--font))',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--accent, #2dacf9)',
})
const overlayLink = css({ color: 'var(--accent, #2dacf9)', textDecoration: 'none' })
