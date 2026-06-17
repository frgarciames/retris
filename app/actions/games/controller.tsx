import { Database } from 'remix/data-table'
import * as s from 'remix/data-schema'
import { Auth } from 'remix/middleware/auth'
import { createController } from 'remix/router'
import { Session } from 'remix/session'

import { createGame, getGameWithUsername } from '../../data/games.ts'
import { simulate, type RecordedAction } from '../../game/engine.ts'
import { getMode, isValidMode } from '../../game/modes.ts'
import { readTheme } from '../../middleware/theme.ts'
import { routes } from '../../routes.ts'
import { storePendingGame } from '../../utils/pending-game.ts'
import { ReplayPage } from './replay-page.tsx'

const MAX_ACTIONS = 100_000

// Validates a single recorded input. The board itself is never trusted; only
// the seed + this input list, which the engine replays deterministically.
let actionLiteral = s.union([
  s.literal('left'),
  s.literal('right'),
  s.literal('rotateCW'),
  s.literal('rotateCCW'),
  s.literal('softDrop'),
  s.literal('hardDrop'),
  s.literal('hold'),
])
let recordedSchema = s.array(
  s.object({
    tick: s.number().refine(Number.isInteger, 'tick must be an integer'),
    action: actionLiteral,
  }),
)

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export default createController(routes.games, {
  actions: {
    // POST /games — accept a finished replay, re-simulate it server-side, and
    // store the authoritative result. Anonymous runs are verified the same way
    // but parked in the session; signing in afterwards claims them.
    async submit(context) {
      let form = context.get(FormData)
      let seed = Number(form.get('seed'))
      let mode = String(form.get('mode') ?? '')
      let actionsRaw = form.get('actions')

      if (!Number.isInteger(seed) || seed < 0 || !isValidMode(mode)) {
        return json({ error: 'Invalid game parameters.' }, 400)
      }
      if (typeof actionsRaw !== 'string') {
        return json({ error: 'Missing replay data.' }, 400)
      }

      let decoded: unknown
      try {
        decoded = JSON.parse(actionsRaw)
      } catch {
        return json({ error: 'Malformed replay data.' }, 400)
      }

      let parsed = s.parseSafe(recordedSchema, decoded)
      if (!parsed.success || parsed.value.length > MAX_ACTIONS) {
        return json({ error: 'Invalid replay data.' }, 400)
      }
      let actions = parsed.value as RecordedAction[]

      // The canonical time and line count come from re-simulation, not the
      // client. A replay that does not actually reach the goal is rejected.
      let result = simulate(seed, mode, actions)
      if (!result.won) {
        return json({ error: 'Run did not complete the goal.' }, 400)
      }

      let goal = getMode(mode)!.goal
      let verified = {
        mode,
        seed,
        lines_goal: goal.type === 'lines' ? goal.count : 0,
        duration_ms: result.durationMs,
        lines_cleared: result.linesCleared,
        actions: JSON.stringify(actions),
      }

      let auth = context.get(Auth)
      if (!auth.ok) {
        // Verified but anonymous: keep it in the session so login/signup can
        // claim it, and tell the client to prompt for sign-in.
        storePendingGame(context.get(Session), verified)
        return json({ pending: true })
      }

      let db = context.get(Database)
      let id = await createGame(db, { ...verified, user_id: auth.identity.id })

      return json({ href: routes.games.show.href({ id: String(id) }) })
    },

    // GET /games/:id — public replay viewer.
    async show(context) {
      let id = Number(context.params.id)
      if (!Number.isInteger(id)) return new Response('Not Found', { status: 404 })

      let db = context.get(Database)
      let found = await getGameWithUsername(db, id)
      if (!found) return new Response('Not Found', { status: 404 })

      let auth = context.get(Auth)
      let viewer = auth.ok ? { username: auth.identity.username } : null
      let theme = await readTheme(context.request)
      return context.render(
        <ReplayPage
          game={found.game}
          username={found.username}
          viewer={viewer}
          theme={theme}
        />,
      )
    },
  },
})
