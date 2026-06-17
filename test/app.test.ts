import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { db } from '../app/data/db.ts'
import { findByUsername } from '../app/data/users.ts'
import { themeCookie } from '../app/middleware/theme.ts'
import { router } from '../app/router.ts'
import { routes } from '../app/routes.ts'
import { ADMIN_USERNAME } from '../app/utils/admin.ts'
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

describe('auth + game submission', () => {
  it('signs a new user up and logs them in', async () => {
    let res = await signup('alice')
    assert.equal(res.status, 303)
    let cookie = sessionCookie(res)
    assert.match(cookie, /^session=/)

    // The logged-in home page greets the user by name.
    let home = await router.fetch(new Request(url(routes.home.href()), { headers: { cookie } }))
    assert.equal(home.status, 200)
    assert.match(await home.text(), /alice/)
  })

  it('rejects duplicate usernames', async () => {
    await signup('bob')
    let again = await signup('bob')
    assert.equal(again.status, 400)
    assert.match(await again.text(), /taken/i)
  })

  it('serves the game to anonymous visitors on the home page', async () => {
    let res = await router.fetch(new Request(url(routes.home.href())))
    assert.equal(res.status, 200)
    assert.match(await res.text(), /Playing as a guest/)
  })

  it('still validates anonymous submissions', async () => {
    let body = new FormData()
    body.set('seed', '123')
    body.set('mode', 'sprint40')
    body.set('actions', '[]')
    let res = await router.fetch(
      new Request(url(routes.games.submit.href()), { method: 'POST', body }),
    )
    assert.equal(res.status, 400)
  })

  it('parks an anonymous run in the session and claims it at signup', async () => {
    let replay = generateWinningReplay(7)
    let body = new FormData()
    body.set('seed', String(replay.seed))
    body.set('mode', replay.mode)
    body.set('actions', JSON.stringify(replay.actions))
    let submit = await router.fetch(
      new Request(url(routes.games.submit.href()), { method: 'POST', body }),
    )
    assert.equal(submit.status, 200)
    assert.deepEqual(await submit.json(), { pending: true })
    let cookie = sessionCookie(submit)
    assert.match(cookie, /^session=/)

    // Signing up with the same session claims the parked run and lands on its
    // replay page.
    let signupBody = new FormData()
    signupBody.set('username', 'guest-grace')
    signupBody.set('password', 'hunter2pass')
    let signupRes = await router.fetch(
      new Request(url(routes.auth.signup.action.href()), {
        method: 'POST',
        body: signupBody,
        headers: { cookie },
      }),
    )
    assert.equal(signupRes.status, 303)
    let location = signupRes.headers.get('location') ?? ''
    assert.match(location, /^\/games\/\d+$/)

    // The saved replay is public and attributed to the new user.
    let show = await router.fetch(new Request(url(location)))
    assert.equal(show.status, 200)
    assert.match(await show.text(), /guest-grace/)

    // The claim is one-shot: logging in again does not duplicate the game.
    let loginBody = new FormData()
    loginBody.set('username', 'guest-grace')
    loginBody.set('password', 'hunter2pass')
    let cookie2 = sessionCookie(signupRes)
    let loginRes = await router.fetch(
      new Request(url(routes.auth.login.action.href()), {
        method: 'POST',
        body: loginBody,
        headers: { cookie: cookie2 },
      }),
    )
    assert.equal(loginRes.status, 303)
    assert.equal(loginRes.headers.get('location'), '/')
  })

  it('saves a logged-in run directly', async () => {
    let cookie = sessionCookie(await signup('carol'))
    let replay = generateWinningReplay(11)
    let body = new FormData()
    body.set('seed', String(replay.seed))
    body.set('mode', replay.mode)
    body.set('actions', JSON.stringify(replay.actions))
    let res = await router.fetch(
      new Request(url(routes.games.submit.href()), { method: 'POST', body, headers: { cookie } }),
    )
    assert.equal(res.status, 200)
    let data = (await res.json()) as { href?: string }
    assert.match(data.href ?? '', /^\/games\/\d+$/)
  })

  it('rejects a replay that does not actually complete the goal', async () => {
    let cookie = sessionCookie(await signup('dave'))
    let body = new FormData()
    body.set('seed', '123')
    body.set('mode', 'sprint40')
    body.set('actions', JSON.stringify([{ tick: 1, action: 'hardDrop' }]))
    let res = await router.fetch(
      new Request(url(routes.games.submit.href()), { method: 'POST', body, headers: { cookie } }),
    )
    assert.equal(res.status, 400)
    assert.match(await res.text(), /did not complete/i)
  })

  it('rejects malformed replay payloads', async () => {
    let cookie = sessionCookie(await signup('erin'))
    let body = new FormData()
    body.set('seed', '123')
    body.set('mode', 'sprint40')
    body.set('actions', 'not json')
    let res = await router.fetch(
      new Request(url(routes.games.submit.href()), { method: 'POST', body, headers: { cookie } }),
    )
    assert.equal(res.status, 400)
  })

  it('sets the theme cookie without a redirect for fetch callers', async () => {
    let body = new FormData()
    body.set('theme', 'retro')
    let res = await router.fetch(
      new Request(url(routes.theme.href()), {
        method: 'POST',
        body,
        headers: { accept: 'application/json' },
      }),
    )
    assert.equal(res.status, 204)
    assert.equal(res.headers.get('set-cookie'), await themeCookie.serialize('retro'))
  })

  it('serves the public leaderboard page', async () => {
    let res = await router.fetch(new Request(url(routes.leaderboard.href())))
    assert.equal(res.status, 200)
    assert.match(await res.text(), /Leaderboard/)
  })
})

describe('admin', () => {
  // One admin session shared across the cases below; signup is idempotent here
  // because each call uses a fresh username except the admin account, which is
  // created once.
  let adminCookiePromise: Promise<string> | null = null
  function adminCookie(): Promise<string> {
    adminCookiePromise ??= signup(ADMIN_USERNAME).then((res) => {
      assert.equal(res.status, 303)
      return sessionCookie(res)
    })
    return adminCookiePromise
  }

  async function submitWinningRun(cookie: string, seed: number): Promise<string> {
    let replay = generateWinningReplay(seed)
    let body = new FormData()
    body.set('seed', String(replay.seed))
    body.set('mode', replay.mode)
    body.set('actions', JSON.stringify(replay.actions))
    let res = await router.fetch(
      new Request(url(routes.games.submit.href()), { method: 'POST', body, headers: { cookie } }),
    )
    assert.equal(res.status, 200)
    let data = (await res.json()) as { href: string }
    return data.href
  }

  it('hides the admin page from anonymous visitors', async () => {
    let res = await router.fetch(new Request(url(routes.admin.index.href())))
    assert.equal(res.status, 404)
  })

  it('hides the admin page from regular users', async () => {
    let cookie = sessionCookie(await signup('not-the-admin'))
    let res = await router.fetch(
      new Request(url(routes.admin.index.href()), { headers: { cookie } }),
    )
    assert.equal(res.status, 404)
  })

  it('hides the delete actions from regular users', async () => {
    let cookie = sessionCookie(await signup('still-not-admin'))
    let res = await router.fetch(
      new Request(url(routes.admin.deleteUser.href({ id: '1' })), {
        method: 'POST',
        body: new FormData(),
        headers: { cookie },
      }),
    )
    assert.equal(res.status, 404)
  })

  it('shows both tables to the admin account', async () => {
    let cookie = await adminCookie()
    let res = await router.fetch(
      new Request(url(routes.admin.index.href()), { headers: { cookie } }),
    )
    assert.equal(res.status, 200)
    let html = await res.text()
    assert.match(html, /Users/)
    assert.match(html, /Games/)
    assert.match(html, /not-the-admin/)
  })

  it('lets the admin delete a single game', async () => {
    let playerCookie = sessionCookie(await signup('doomed-game-guy'))
    let gameHref = await submitWinningRun(playerCookie, 21)
    let gameId = gameHref.match(/^\/games\/(\d+)$/)![1]!

    let cookie = await adminCookie()
    let body = new FormData()
    body.set('users', '1')
    body.set('games', '1')
    let res = await router.fetch(
      new Request(url(routes.admin.deleteGame.href({ id: gameId })), {
        method: 'POST',
        body,
        headers: { cookie },
      }),
    )
    assert.equal(res.status, 303)
    assert.equal(res.headers.get('location'), '/admin?users=1&games=1')

    let show = await router.fetch(new Request(url(gameHref)))
    assert.equal(show.status, 404)

    // The player account itself survives.
    let user = await findByUsername(db, 'doomed-game-guy')
    assert.ok(user)
  })

  it('lets the admin delete a user along with their games', async () => {
    let playerCookie = sessionCookie(await signup('doomed-user'))
    let gameHref = await submitWinningRun(playerCookie, 22)
    let victim = await findByUsername(db, 'doomed-user')
    assert.ok(victim)

    let cookie = await adminCookie()
    let res = await router.fetch(
      new Request(url(routes.admin.deleteUser.href({ id: String(victim.id) })), {
        method: 'POST',
        body: new FormData(),
        headers: { cookie },
      }),
    )
    assert.equal(res.status, 303)

    assert.equal(await findByUsername(db, 'doomed-user'), null)
    let show = await router.fetch(new Request(url(gameHref)))
    assert.equal(show.status, 404)
  })

  it('refuses to delete the admin account itself', async () => {
    let cookie = await adminCookie()
    let admin = await findByUsername(db, ADMIN_USERNAME)
    assert.ok(admin)
    let res = await router.fetch(
      new Request(url(routes.admin.deleteUser.href({ id: String(admin.id) })), {
        method: 'POST',
        body: new FormData(),
        headers: { cookie },
      }),
    )
    assert.equal(res.status, 400)
    assert.ok(await findByUsername(db, ADMIN_USERNAME))
  })
})
