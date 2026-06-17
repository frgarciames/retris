import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { isF4Shortcut, shouldRunF4Shortcut } from './shortcuts.ts'

describe('board shortcuts', () => {
  it('recognizes F4 as the restart/surrender shortcut', () => {
    assert.equal(isF4Shortcut('F4'), true)
    assert.equal(isF4Shortcut('f4'), false)
    assert.equal(isF4Shortcut('Escape'), false)
  })

  it('runs the F4 action once per physical key press', () => {
    assert.equal(shouldRunF4Shortcut('F4', false), true)
    assert.equal(shouldRunF4Shortcut('F4', true), false)
    assert.equal(shouldRunF4Shortcut('Escape', false), false)
  })
})
