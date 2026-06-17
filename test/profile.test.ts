import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { db } from '../app/data/db.ts'
import { findByUsername } from '../app/data/users.ts'
import { createVersusGame } from '../app/data/versus.ts'
import { router } from '../app/router.ts'
import { routes } from '../app/routes.ts'
import { generateWinningReplay } from './win-replay.ts'

const BASE = 'http://localhost'
const url = (path: string) => BASE + path

function sessionCookie(res: Response): string {
  let setCookie = res.headers.get('set-cookie') ?? ''
  return setCookie.split(';')[0]! // "session=..."
}

async function signup(username: string, password = 'hunter2pass'): Promise<Response> {
  let body = new FormData()
  body.set('username', username)
  body.set('password', password)
  return router.fetch(
    new Request(url(routes.auth.signup.action.href()), { method: 'POST', body }),
  )
}

async function submitRun(cookie: string, seed: number, mode = 'sprint40'): Promise<void> {
  let replay = generateWinningReplay(seed, mode)
  let body = new FormData()
  body.set('seed', String(replay.seed))
  body.set('mode', replay.mode)
  body.set('actions', JSON.stringify(replay.actions))
  let res = await router.fetch(
    new Request(url(routes.games.submit.href()), { method: 'POST', body, headers: { cookie } }),
  )
  assert.equal(res.status, 200)
}

// Inserts a finished 1v1 row for `userId` directly (matches are normally written
// by the multiplayer hub, which the router cannot drive in a unit test).
async function addVersus(userId: number, name: string, won: boolean, seed: number): Promise<void> {
  await createVersusGame(db, {
    winner_user_id: won ? userId : null,
    loser_user_id: won ? null : userId,
    winner_name: won ? name : 'guest',
    loser_name: won ? 'guest' : name,
    seed,
    winner_actions: '[]',
    winner_garbage: '[]',
    winner_lines: 40,
    loser_actions: '[]',
    loser_garbage: '[]',
    loser_lines: 0,
  })
}

describe('profile', () => {
  it('redirects anonymous visitors to log in and back', async () => {
    let res = await router.fetch(new Request(url(routes.profile.href())))
    assert.equal(res.status, 303)
    let location = res.headers.get('location') ?? ''
    assert.match(location, /^\/auth\/login\?returnTo=/)
    assert.match(decodeURIComponent(location), /returnTo=\/profile/)
  })

  it("lists the user's solo runs and 1v1 matches with replay links", async () => {
    let cookie = sessionCookie(await signup('profile-fan'))
    let user = await findByUsername(db, 'profile-fan')
    assert.ok(user)

    await submitRun(cookie, 101, 'sprint40')
    await submitRun(cookie, 102, 'sprint20')
    await addVersus(user.id, 'profile-fan', true, 1) // a win
    await addVersus(user.id, 'profile-fan', false, 2) // a loss

    let res = await router.fetch(new Request(url(routes.profile.href()), { headers: { cookie } }))
    assert.equal(res.status, 200)
    let html = await res.text()

    assert.match(html, /4 total/)
    // Both solo mode labels and both 1v1 result chips are present.
    assert.match(html, /40 Lines/)
    assert.match(html, /20 Lines/)
    assert.match(html, /Won/)
    assert.match(html, /Lost/)
    // Replay links point at the right viewer for each kind.
    assert.match(html, /href="\/games\/\d+"/)
    assert.match(html, /href="\/1vs1\/games\/\d+"/)
  })

  it('shows each user only their own games', async () => {
    // A user with a game.
    let otherCookie = sessionCookie(await signup('profile-other'))
    await submitRun(otherCookie, 201, 'sprint40')
    let other = await findByUsername(db, 'profile-other')
    assert.ok(other)
    let otherGameId = (await router
      .fetch(new Request(url(routes.profile.href()), { headers: { cookie: otherCookie } }))
      .then((r) => r.text())
      .then((h) => h.match(/href="\/games\/(\d+)"/)?.[1]))!
    assert.ok(otherGameId)

    // A fresh user sees an empty history, not anyone else's game.
    let cookie = sessionCookie(await signup('profile-empty'))
    let html = await router
      .fetch(new Request(url(routes.profile.href()), { headers: { cookie } }))
      .then((r) => r.text())
    assert.match(html, /No games yet/)
    assert.match(html, /0 total/)
    assert.doesNotMatch(html, new RegExp(`/games/${otherGameId}"`))
  })

  it('paginates a user with more than one page of games', async () => {
    let cookie = sessionCookie(await signup('profile-prolific'))
    let user = await findByUsername(db, 'profile-prolific')
    assert.ok(user)
    for (let i = 0; i < 21; i++) await addVersus(user.id, 'profile-prolific', i % 2 === 0, 1000 + i)

    let page1 = await router
      .fetch(new Request(url(routes.profile.href()), { headers: { cookie } }))
      .then((r) => r.text())
    assert.match(page1, /21 total/)
    assert.match(page1, /Page 1 of 2/)

    let page2 = await router
      .fetch(new Request(url(`${routes.profile.href()}?page=2`), { headers: { cookie } }))
      .then((r) => r.text())
    assert.match(page2, /Page 2 of 2/)
  })
})
