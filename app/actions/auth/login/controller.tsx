import { Database } from 'remix/data-table'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'
import { Session } from 'remix/session'

import { readTheme } from '../../../middleware/theme.ts'
import { findByUsername } from '../../../data/users.ts'
import { routes } from '../../../routes.ts'
import { AuthPage } from '../../../ui/auth-form.tsx'
import { claimPendingGame } from '../../../utils/pending-game.ts'
import { safeReturnTo } from '../../../utils/redirects.ts'
import { verifyPassword } from '../../../utils/passwords.ts'

let loginSchema = f.object({
  username: f.field(s.string()),
  password: f.field(s.string()),
  returnTo: f.field(s.defaulted(s.string(), '')),
})

export default createController(routes.auth.login, {
  actions: {
    async index(context) {
      let returnTo = context.url.searchParams.get('returnTo') ?? undefined
      let theme = await readTheme(context.request)
      return context.render(
        <AuthPage mode="login" returnTo={returnTo} theme={theme} />,
      )
    },

    async action(context) {
      let theme = await readTheme(context.request)
      let parsed = s.parseSafe(loginSchema, context.get(FormData))
      if (!parsed.success) {
        return context.render(
          <AuthPage mode="login" error="Enter a username and password." theme={theme} />,
          { status: 400 },
        )
      }

      let { username, password, returnTo } = parsed.value
      let db = context.get(Database)
      let user = await findByUsername(db, username)
      if (!user || !(await verifyPassword(password, user.password_hash))) {
        return context.render(
          <AuthPage mode="login" error="Invalid username or password." username={username} returnTo={returnTo} theme={theme} />,
          { status: 400 },
        )
      }

      let session = context.get(Session)
      session.regenerateId(true)
      session.set('auth', { userId: user.id })

      // An anonymous run finished before logging in lands on its replay page.
      let claimedId = await claimPendingGame(session, db, user.id)
      if (claimedId !== null) {
        return redirect(routes.games.show.href({ id: String(claimedId) }), 303)
      }

      return redirect(safeReturnTo(returnTo, routes.home.href()), 303)
    },
  },
})
