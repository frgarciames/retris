import { Database } from 'remix/data-table'
import * as s from 'remix/data-schema'
import { maxLength, minLength, email } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'
import { Session } from 'remix/session'

import { readTheme } from '../../../middleware/theme.ts'
import { createUser } from '../../../data/users.ts'
import { routes } from '../../../routes.ts'
import { AuthPage } from '../../../ui/auth-form.tsx'
import { claimPendingGame } from '../../../utils/pending-game.ts'
import { safeReturnTo } from '../../../utils/redirects.ts'

let signupSchema = f.object({
  username: f.field(s.string().pipe(minLength(3), maxLength(20))),
  email: f.field(s.string().pipe(email())),
  password: f.field(s.string().pipe(minLength(6))),
  returnTo: f.field(s.defaulted(s.string(), '')),
})

export default createController(routes.auth.signup, {
  actions: {
    async index(context) {
      let returnTo = context.url.searchParams.get('returnTo') ?? undefined
      let theme = await readTheme(context.request)
      return context.render(
        <AuthPage mode="signup" returnTo={returnTo} theme={theme} />,
      )
    },

    async action(context) {
      let theme = await readTheme(context.request)
      let formData = context.get(FormData)
      let parsed = s.parseSafe(signupSchema, formData)
      if (!parsed.success) {
        return context.render(
          <AuthPage
            mode="signup"
            error="Enter a valid email, username (3-20 characters), and password (at least 6)."
            username={String(formData.get('username') ?? '')}
            email={String(formData.get('email') ?? '')}
            theme={theme}
          />,
          { status: 400 },
        )
      }

      let { username, email: userEmail, password, returnTo } = parsed.value
      let db = context.get(Database)
      let result = await createUser(db, username, userEmail, password)
      if (!result.ok) {
        let message =
          result.reason === 'email_taken'
            ? 'That email is already in use.'
            : 'That username is taken.'
        return context.render(
          <AuthPage
            mode="signup"
            error={message}
            username={username}
            email={userEmail}
            returnTo={returnTo}
            theme={theme}
          />,
          { status: 400 },
        )
      }

      let session = context.get(Session)
      session.regenerateId(true)
      session.set('auth', { userId: result.user.id })

      // An anonymous run finished before signing up lands on its replay page.
      let claimedId = await claimPendingGame(session, db, result.user.id)
      if (claimedId !== null) {
        return redirect(routes.games.show.href({ id: String(claimedId) }), 303)
      }

      return redirect(safeReturnTo(returnTo, routes.home.href()), 303)
    },
  },
})
