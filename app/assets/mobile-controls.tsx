import { ChevronDown } from 'lucide-remix/icons/chevron-down';
import { ChevronLeft } from 'lucide-remix/icons/chevron-left';
import { ChevronRight } from 'lucide-remix/icons/chevron-right';
import { ChevronUp } from 'lucide-remix/icons/chevron-up';
import { addEventListeners, css, on, type Handle } from 'remix/ui'

const SWIPE_MIN = 24

export interface MobileControlsProps {
  disabled?: boolean
  onPressLeft(): void
  onReleaseLeft(): void
  onPressRight(): void
  onReleaseRight(): void
  onPressUp(): void
  onReleaseUp(): void
  onDown(): void
  onA(): void
  onB(): void
}

export function MobileControls(handle: Handle<MobileControlsProps>) {
  // ----- dpad helpers -----

  function startPress(event: PointerEvent, run: () => void) {
    if (handle.props.disabled) return
    event.preventDefault()
    let button = event.currentTarget as HTMLElement | null
    button?.setPointerCapture(event.pointerId)
    run()
  }

  function stopPress(event: PointerEvent, run: () => void) {
    event.preventDefault()
    let button = event.currentTarget as HTMLElement | null
    if (button?.hasPointerCapture(event.pointerId)) {
      button.releasePointerCapture(event.pointerId)
    }
    run()
  }

  function tap(event: PointerEvent, run: () => void) {
    if (handle.props.disabled) return
    event.preventDefault()
    run()
  }

  // ----- joystick (dpad centre touch area) -----

  let joystickId = handle.id + '-joystick'
  let startX = 0
  let startY = 0
  let currentDir: 'left' | 'right' | 'down' | 'up' | null = null
  let moved = false

  function releaseJoystick() {
    if (currentDir === 'left') handle.props.onReleaseLeft()
    else if (currentDir === 'right') handle.props.onReleaseRight()
    else if (currentDir === 'down') handle.props.onReleaseUp()
    currentDir = null
  }

  function pressJoystickDir(dir: 'left' | 'right' | 'down') {
    if (dir === 'left') handle.props.onPressLeft()
    else if (dir === 'right') handle.props.onPressRight()
    else handle.props.onPressUp()
  }

  if (typeof document !== 'undefined') {
    addEventListeners(document, handle.signal, {
      touchstart(event) {
        let target = event.target as HTMLElement | null
        if (!target?.closest(`[data-joystick="${joystickId}"]`)) return
        if (handle.props.disabled) return
        event.preventDefault()
        let touch = (event as TouchEvent).changedTouches[0]
        if (!touch) return
        startX = touch.clientX
        startY = touch.clientY
        moved = false
        releaseJoystick()
      },
      touchmove(event) {
        let target = event.target as HTMLElement | null
        if (!target?.closest(`[data-joystick="${joystickId}"]`)) return
        if (handle.props.disabled) return
        event.preventDefault()
        let touch = (event as TouchEvent).changedTouches[0]
        if (!touch) return
        let dx = touch.clientX - startX
        let dy = touch.clientY - startY
        if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return
        moved = true
        let dir: typeof currentDir = null
        if (Math.abs(dx) > Math.abs(dy)) {
          dir = dx > 0 ? 'right' : 'left'
        } else {
          dir = dy > 0 ? 'down' : 'up'
        }
        if (dir === 'up') {
          if (currentDir !== 'up') handle.props.onDown()
          currentDir = 'up'
          return
        }
        if (dir === currentDir) return
        releaseJoystick()
        pressJoystickDir(dir)
        currentDir = dir
      },
      touchend(event) {
        let target = event.target as HTMLElement | null
        if (!target?.closest(`[data-joystick="${joystickId}"]`)) return
        releaseJoystick()
        if (!moved && !handle.props.disabled) {
          handle.props.onA()
        }
        moved = false
      },
      touchcancel() {
        releaseJoystick()
        moved = false
      },
    })
  }

  return () => (
    <section mix={rootStyle} aria-label="Touch controls">
      <div mix={shellStyle}>
        <div mix={dpadStyle}>
          <div />
          <button
            type="button"
            aria-label="Move up"
            disabled={handle.props.disabled}
            mix={[
              baseButtonStyle,
              dpadButtonStyle,
              on('pointerdown', (event) => tap(event, handle.props.onDown)),
            ]}
          >
            <ChevronUp />
          </button>
          <div />
          <button
            type="button"
            aria-label="Move left"
            disabled={handle.props.disabled}
            mix={[
              baseButtonStyle,
              dpadButtonStyle,
              on('pointerdown', (event) => startPress(event, handle.props.onPressLeft)),
              on('pointerup', (event) => stopPress(event, handle.props.onReleaseLeft)),
              on('pointercancel', (event) => stopPress(event, handle.props.onReleaseLeft)),
              on('lostpointercapture', () => handle.props.onReleaseLeft()),
            ]}
          >
            <ChevronLeft />
          </button>
          <div
            mix={dpadCenterStyle}
            aria-label="Joystick — drag to move, tap to hard drop"
            role="button"
            tabIndex={-1}
            data-joystick={joystickId}
          />
          <button
            type="button"
            aria-label="Move right"
            disabled={handle.props.disabled}
            mix={[
              baseButtonStyle,
              dpadButtonStyle,
              on('pointerdown', (event) => startPress(event, handle.props.onPressRight)),
              on('pointerup', (event) => stopPress(event, handle.props.onReleaseRight)),
              on('pointercancel', (event) => stopPress(event, handle.props.onReleaseRight)),
              on('lostpointercapture', () => handle.props.onReleaseRight()),
            ]}
          >
            <ChevronRight />
          </button>
          <div />
          <button
            type="button"
            aria-label="Rotate piece"
            disabled={handle.props.disabled}
            mix={[
              baseButtonStyle,
              dpadButtonStyle,
              on('pointerdown', (event) => startPress(event, handle.props.onPressUp)),
              on('pointerup', (event) => stopPress(event, handle.props.onReleaseUp)),
              on('pointercancel', (event) => stopPress(event, handle.props.onReleaseUp)),
              on('lostpointercapture', () => handle.props.onReleaseUp()),
            ]}
          >
            <ChevronDown />
          </button>
          <div />
        </div>

        <div mix={actionClusterStyle}>
          <button
            type="button"
            aria-label="B button hold piece"
            disabled={handle.props.disabled}
            mix={[
              baseButtonStyle,
              actionButtonStyle,
              holdButtonStyle,
              on('pointerdown', (event) => tap(event, handle.props.onB)),
            ]}
          >
            B
          </button>
          <button
            type="button"
            aria-label="A button hard drop"
            disabled={handle.props.disabled}
            mix={[
              baseButtonStyle,
              actionButtonStyle,
              accentButtonStyle,
              on('pointerdown', (event) => tap(event, handle.props.onA)),
            ]}
          >
            A
          </button>
        </div>
      </div>
    </section>
  )
}

const rootStyle = css({
  display: 'none',
  '@media (max-width: 640px)': {
    display: 'block',
    bottom: 'calc(8px + env(safe-area-inset-bottom))',
    zIndex: 3,
  },
})

const shellStyle = css({
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: '6px',
  padding: '12px 24px',
  borderRadius: '26px',
  background: 'color-mix(in srgb, var(--panel) 55%, transparent)',
  boxShadow: 'var(--shadow-panel, none)',
  backdropFilter: 'blur(10px)',
})

const dpadStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 40px)',
  gridTemplateRows: 'repeat(3, 40px)',
  gap: '6px',
})

const baseButtonStyle = css({
  appearance: 'none',
  border: 'var(--border-w, 1px) solid var(--border)',
  background: 'color-mix(in srgb, var(--panel-2) 70%, transparent)',
  color: 'var(--text, #f3f6fb)',
  font: 'inherit',
  fontWeight: 700,
  touchAction: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  WebkitTapHighlightColor: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '&:active': { transform: 'translateY(1px)' },
  '&:disabled': { opacity: 0.45 },
})

const dpadButtonStyle = css({
  width: '40px',
  height: '40px',
  borderRadius: 'var(--radius-sm, 8px)',
  fontSize: '26px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
})

const dpadCenterStyle = css({
  width: '40px',
  height: '40px',
  borderRadius: 'var(--radius-sm, 8px)',
  background: 'color-mix(in srgb, var(--bg) 45%, transparent)',
  touchAction: 'none',
})

const actionClusterStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  paddingBottom: '10px',
  '@media (max-width: 380px)': {
    gap: '10px',
    paddingBottom: '8px',
  },
})

const actionButtonStyle = css({
  width: '52px',
  height: '52px',
  borderRadius: '50%',
  fontSize: '28px',
  boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
  '@media (max-width: 380px)': {
    width: '64px',
    height: '64px',
  },
})

const holdButtonStyle = css({
  background: 'color-mix(in srgb, var(--muted) 50%, var(--panel-2))',
})

const accentButtonStyle = css({
  background: 'var(--accent)',
  borderColor: 'var(--accent)',
  color: 'var(--accent-ink, #04121d)',
  boxShadow: 'var(--glow, none)',
  position: 'relative',
  right: '0rem',
  bottom: '3.5rem'
})
