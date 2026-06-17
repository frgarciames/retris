import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { connectPlayer, disconnectStream, reportFinish } from './hub.ts'

interface SentEvent {
  event: string
  data: unknown
}

function finish(result: 'won' | 'lost', reason?: 'surrendered') {
  return {
    result,
    reason,
    actions: '[]',
    garbage: '[]',
    lines: 0,
  }
}

describe('multiplayer hub surrender', () => {
  it('treats a surrendered loss as an opponent win with a surrender reason', () => {
    let aEvents: SentEvent[] = []
    let bEvents: SentEvent[] = []
    let unique = Date.now().toString(36)
    let aId = `surrender-a-${unique}`
    let bId = `surrender-b-${unique}`

    connectPlayer(aId, 'Alice', null, (event, data) => aEvents.push({ event, data }))
    connectPlayer(bId, 'Bob', null, (event, data) => bEvents.push({ event, data }))

    assert.equal(aEvents.some((e) => e.event === 'start'), true)
    assert.equal(bEvents.some((e) => e.event === 'start'), true)

    reportFinish(aId, finish('lost', 'surrendered'))

    assert.deepEqual(bEvents.at(-1), {
      event: 'win',
      data: { reason: 'surrendered' },
    })

    // Let the match clean itself up so this singleton hub test does not leave
    // an over-but-unpersisted match behind for later tests.
    reportFinish(bId, finish('won'))
  })

  it('cancels a match when both players disconnect', () => {
    let aEvents: SentEvent[] = []
    let bEvents: SentEvent[] = []
    let unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    let aId = `cancel-a-${unique}`
    let bId = `cancel-b-${unique}`

    let a = connectPlayer(aId, 'Alice', null, (event, data) => aEvents.push({ event, data }))
    let b = connectPlayer(bId, 'Bob', null, (event, data) => bEvents.push({ event, data }))

    assert.equal(aEvents.some((e) => e.event === 'start'), true)
    assert.equal(bEvents.some((e) => e.event === 'start'), true)

    disconnectStream(aId, a.streamToken)
    assert.equal(bEvents.at(-1)?.event, 'opponent_disconnected')

    disconnectStream(bId, b.streamToken)

    let aReconnectEvents: SentEvent[] = []
    let aFresh = connectPlayer(aId, 'Alice', null, (event, data) =>
      aReconnectEvents.push({ event, data }),
    )

    assert.deepEqual(aReconnectEvents, [
      { event: 'hello', data: { reconnected: false, canceled: true } },
      { event: 'waiting', data: { canceled: true } },
    ])

    disconnectStream(aId, aFresh.streamToken)
  })
})
