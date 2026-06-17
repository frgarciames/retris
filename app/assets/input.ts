// Keyboard → per-tick action stream for the live boards. Translates held keys
// into the engine's discrete actions with DAS/ARR horizontal auto-shift and
// soft-drop repeat, all measured in ticks so the feel is frame-rate independent.
// Browser-only; shared by the single-player and 1v1 boards.

import type { Action } from '../game/engine.ts'

const DAS_TICKS = 9 // delay before auto-shift kicks in
const ARR_TICKS = 2 // auto-shift repeat interval
const SOFT_DROP_TICKS = 2 // soft-drop repeat interval

export class InputController {
  private moveDir = 0 // -1 left, 1 right, 0 none
  private moveCharge = 0
  private softHeld = false
  private softCharge = 0
  private heldLeft = false
  private heldRight = false
  private oneShots: Action[] = []
  private hardDropQueued = false

  reset(): void {
    this.moveDir = 0
    this.moveCharge = 0
    this.softHeld = false
    this.softCharge = 0
    this.heldLeft = false
    this.heldRight = false
    this.oneShots = []
    this.hardDropQueued = false
  }

  pressLeft(): void {
    this.heldLeft = true
    this.moveDir = -1
    this.moveCharge = 0
  }

  releaseLeft(): void {
    this.heldLeft = false
    this.moveDir = this.heldRight ? 1 : 0
  }

  pressRight(): void {
    this.heldRight = true
    this.moveDir = 1
    this.moveCharge = 0
  }

  releaseRight(): void {
    this.heldRight = false
    this.moveDir = this.heldLeft ? -1 : 0
  }

  pressSoftDrop(): void {
    this.softHeld = true
    this.softCharge = 0
  }

  releaseSoftDrop(): void {
    this.softHeld = false
  }

  tapRotateCW(): void {
    this.oneShots.push('rotateCW')
  }

  tapRotateCCW(): void {
    this.oneShots.push('rotateCCW')
  }

  tapLeft(): void {
    this.oneShots.push('left')
  }

  tapRight(): void {
    this.oneShots.push('right')
  }

  tapSoftDrop(): void {
    this.oneShots.push('softDrop')
  }

  tapHardDrop(): void {
    this.hardDropQueued = true
  }

  tapHold(): void {
    this.oneShots.push('hold')
  }

  // Record a keydown. Returns true when the key is a game input the caller
  // should `preventDefault()`. OS auto-repeat is ignored for one-shots (rotate,
  // hold, hard drop); horizontal repeat is handled by DAS/ARR in `collect()`.
  keyDown(key: string, repeat: boolean): boolean {
    let oneShot =
      key === 'ArrowUp' ||
      key === 'x' ||
      key === 'z' ||
      key === 'Control' ||
      key === ' ' ||
      key === 'c' ||
      key === 'Shift'
    if (repeat && oneShot) return true
    switch (key) {
      case 'ArrowLeft':
      case 'a':
        this.pressLeft()
        break
      case 'ArrowRight':
      case 'd':
        this.pressRight()
        break
      case 'ArrowDown':
      case 's':
        this.pressSoftDrop()
        break
      case 'ArrowUp':
      case 'x':
        this.tapRotateCW()
        break
      case 'z':
      case 'Control':
        this.tapRotateCCW()
        break
      case ' ':
        this.tapHardDrop()
        break
      case 'c':
      case 'Shift':
        this.tapHold()
        break
      default:
        return false
    }
    return true
  }

  keyUp(key: string): void {
    switch (key) {
      case 'ArrowLeft':
      case 'a':
        this.releaseLeft()
        break
      case 'ArrowRight':
      case 'd':
        this.releaseRight()
        break
      case 'ArrowDown':
      case 's':
        this.releaseSoftDrop()
        break
    }
  }

  // Drain one tick's worth of actions: queued one-shots, then DAS/ARR horizontal
  // movement, then soft-drop repeat, then a pending hard drop.
  collect(): Action[] {
    let actions: Action[] = []

    for (let a of this.oneShots) actions.push(a)
    this.oneShots = []

    if (this.moveDir !== 0) {
      let dir: Action = this.moveDir === -1 ? 'left' : 'right'
      if (this.moveCharge === 0) actions.push(dir)
      else if (this.moveCharge >= DAS_TICKS && (this.moveCharge - DAS_TICKS) % ARR_TICKS === 0) {
        actions.push(dir)
      }
      this.moveCharge++
    } else {
      this.moveCharge = 0
    }

    if (this.softHeld) {
      if (this.softCharge % SOFT_DROP_TICKS === 0) actions.push('softDrop')
      this.softCharge++
    } else {
      this.softCharge = 0
    }

    if (this.hardDropQueued) {
      actions.push('hardDrop')
      this.hardDropQueued = false
    }

    return actions
  }
}
