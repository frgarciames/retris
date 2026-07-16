import { addEventListeners, css, on, type Handle } from "remix/ui";

const SWIPE_MIN = 16;
// Ignore a second tap that lands too soon after a rotate — players often tap
// to rotate then immediately touch again to drag, which would otherwise fire
// a second rotate.
const DOUBLE_TAP_MS = 320;
const JOYSTICK_WIDTH = 132;
const DOT_SIZE = 44;
const DOT_RADIUS = DOT_SIZE / 2;

export interface MobileControlsProps {
  disabled?: boolean;
  onPressLeft(): void;
  onReleaseLeft(): void;
  onPressRight(): void;
  onReleaseRight(): void;
  onPressUp(): void;
  onReleaseUp(): void;
  onDown(): void;
  onA(): void;
  onB(): void;
}

export function MobileControls(handle: Handle<MobileControlsProps>) {
  function tap(event: PointerEvent, run: () => void) {
    if (handle.props.disabled) return;
    event.preventDefault();
    run();
  }

  // ----- joystick -----

  let joystickId = handle.id + "-joystick";
  let startX = 0;
  let startY = 0;
  let currentDir: "left" | "right" | "down" | null = null;
  let moved = false;
  let lastRotateTapAt = 0;
  let dotEl: HTMLElement | null = null;
  let joyRect: { w: number; h: number } = { w: 0, h: 0 };

  function releaseJoystick() {
    if (currentDir === "left") handle.props.onReleaseLeft();
    else if (currentDir === "right") handle.props.onReleaseRight();
    else if (currentDir === "down") handle.props.onReleaseUp();
    currentDir = null;
  }

  function pressJoystickDir(dir: "left" | "right" | "down") {
    if (dir === "left") handle.props.onPressLeft();
    else if (dir === "right") handle.props.onPressRight();
    else handle.props.onPressUp();
  }

  function moveDot(dx: number, dy: number) {
    if (!dotEl) return;
    let maxX = joyRect.w / 2 - DOT_RADIUS;
    let maxY = joyRect.h - DOT_SIZE;
    let x = Math.max(-maxX, Math.min(maxX, dx));
    let y = Math.max(0, Math.min(maxY, DOT_RADIUS + dy));
    dotEl.style.transform = `translate(calc(-50% + ${x}px), ${y - DOT_RADIUS}px)`;
  }

  function resetDot() {
    if (dotEl) {
      dotEl.style.transition = "transform 0.15s ease-out";
      dotEl.style.transform = "translate(-50%, 0)";
    }
  }

  if (typeof document !== "undefined") {
    addEventListeners(document, handle.signal, {
      touchstart(event) {
        let target = event.target as HTMLElement | null;
        let joystick = target?.closest(`[data-joystick="${joystickId}"]`) as HTMLElement | null;
        if (!joystick) return;
        if (handle.props.disabled) return;
        event.preventDefault();
        let touch = (event as TouchEvent).changedTouches[0];
        if (!touch) return;
        startX = touch.clientX;
        startY = touch.clientY;
        moved = false;
        releaseJoystick();
        dotEl = joystick.querySelector("[data-joystick-dot]");
        if (dotEl) dotEl.style.transition = "none";
        joyRect.w = joystick.offsetWidth;
        joyRect.h = joystick.offsetHeight;
      },
      touchmove(event) {
        let target = event.target as HTMLElement | null;
        if (!target?.closest(`[data-joystick="${joystickId}"]`)) return;
        if (handle.props.disabled) return;
        event.preventDefault();
        let touch = (event as TouchEvent).changedTouches[0];
        if (!touch) return;
        let dx = touch.clientX - startX;
        let dy = touch.clientY - startY;
        moveDot(dx, dy);
        if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
        moved = true;
        let dir: typeof currentDir;
        if (Math.abs(dx) > Math.abs(dy)) {
          dir = dx > 0 ? "right" : "left";
        } else {
          dir = dy > 0 ? "down" : null;
        }
        if (dir === null) return;
        if (dir === currentDir) return;
        releaseJoystick();
        pressJoystickDir(dir);
        currentDir = dir;
      },
      touchend(event) {
        let target = event.target as HTMLElement | null;
        if (!target?.closest(`[data-joystick="${joystickId}"]`)) return;
        event.preventDefault();
        releaseJoystick();
        resetDot();
        if (!moved && !handle.props.disabled) {
          let now = performance.now();
          if (now - lastRotateTapAt >= DOUBLE_TAP_MS) {
            lastRotateTapAt = now;
            handle.props.onDown();
          }
        }
        moved = false;
      },
      touchcancel() {
        releaseJoystick();
        resetDot();
        moved = false;
      },
    });
  }

  return () => (
    <section mix={rootStyle} aria-label="Touch controls">
      <div mix={shellStyle}>
        <div
          mix={joystickStyle}
          aria-label="Joystick — drag to move, tap to rotate"
          role="button"
          tabIndex={-1}
          data-joystick={joystickId}
        >
          <span mix={joystickDotStyle} data-joystick-dot aria-hidden="true" />
          <div mix={joystickHintStyle} aria-hidden="true">
            <span>Tap = Rotate</span>
            <span>Drag = Move</span>
          </div>
        </div>

        <div mix={actionRowStyle}>
          <button
            type="button"
            aria-label="Hold piece"
            disabled={handle.props.disabled}
            mix={[
              baseButtonStyle,
              actionFullButtonStyle,
              holdButtonStyle,
              on("pointerdown", (event) => tap(event, handle.props.onB)),
            ]}
          >
            Hold
          </button>
          <button
            type="button"
            aria-label="Hard drop"
            disabled={handle.props.disabled}
            mix={[
              baseButtonStyle,
              actionFullButtonStyle,
              accentButtonStyle,
              on("pointerdown", (event) => tap(event, handle.props.onA)),
            ]}
          >
            Drop
          </button>
        </div>
      </div>
    </section>
  );
}

const rootStyle = css({
  display: "none",
  "@media (max-width: 1024px)": {
    display: "block",
    bottom: "calc(8px + env(safe-area-inset-bottom))",
    zIndex: 3,
  },
});

const shellStyle = css({
  display: "flex",
  alignItems: "stretch",
  justifyContent: "space-between",
  gap: "12px",
  padding: "12px 18px",
  borderRadius: "var(--radius-lg, 12px)",
  background: "color-mix(in srgb, var(--panel) 55%, transparent)",
  boxShadow: "var(--shadow-panel, none)",
  backdropFilter: "blur(10px)",
});

const joystickStyle = css({
  position: "relative",
  width: `${JOYSTICK_WIDTH}px`,
  minHeight: "106px",
  borderRadius: "var(--radius-md, 10px)",
  background: "color-mix(in srgb, var(--bg) 45%, transparent)",
  border: "var(--border-w, 1px) solid var(--border)",
  borderTop: "none",
  touchAction: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
  WebkitTapHighlightColor: "transparent",
  flexShrink: 0,
  overflow: "visible",
  boxShadow: "inset 0 2px 8px rgba(0,0,0,0.18)",
});

const joystickDotStyle = css({
  position: "absolute",
  left: "50%",
  top: "0",
  transform: "translate(-50%, 0)",
  width: `${DOT_SIZE}px`,
  height: `${DOT_SIZE}px`,
  borderRadius: "50%",
  background: "color-mix(in srgb, var(--text, #f3f6fb) 75%, transparent)",
  boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
  pointerEvents: "none",
});

const joystickHintStyle = css({
  width: "100%",
  position: "absolute",
  bottom: "10px",
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "2px",
  fontSize: "10px",
  fontWeight: 600,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
  opacity: 0.45,
  pointerEvents: "none",
});

const actionRowStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  flex: 1,
  minWidth: 0,
});

const baseButtonStyle = css({
  appearance: "none",
  border: "var(--border-w, 1px) solid var(--border)",
  background: "color-mix(in srgb, var(--panel-2) 70%, transparent)",
  color: "var(--text, #f3f6fb)",
  font: "inherit",
  fontWeight: 700,
  touchAction: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
  WebkitTapHighlightColor: "transparent",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  "&:active": { transform: "translateY(1px)" },
  "&:disabled": { opacity: 0.45 },
});

const actionFullButtonStyle = css({
  width: "100%",
  flex: 1,
  borderRadius: "var(--radius-sm, 10px)",
  fontSize: "18px",
  letterSpacing: "0.02em",
  boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
});

const holdButtonStyle = css({
  background: "color-mix(in srgb, var(--muted) 50%, var(--panel-2))",
});

const accentButtonStyle = css({
  background: "var(--accent)",
  borderColor: "var(--accent)",
  color: "var(--accent-ink, #04121d)",
  boxShadow: "var(--glow, none)",
});
