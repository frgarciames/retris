import { Database } from 'remix/data-table'
import * as s from 'remix/data-schema'
import { minLength } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'
import { Session } from 'remix/session'

import { consumeResetToken, peekResetToken } from '../../../data/password-reset.ts'
import { updatePassword } from '../../../data/users.ts'
import { readTheme } from '../../../middleware/theme.ts'
import { routes } from '../../../routes.ts'
import { ResetPasswordPage } from '../../../ui/reset-password-page.tsx'

let resetSchema = f.object({
  password: f.field(s.string().pipe(minLength(6))),
})

export default createController(routes.auth.resetPassword, {
  actions: {
    async index(context) {
      let token = context.params.token ?? ''
      let theme = await readTheme(context.request)
      let db = context.get(Database)
      let valid = token && (await peekResetToken(db, token)) !== null
      return context.render(
        <ResetPasswordPage token={token} invalid={!valid} theme={theme} />,
        valid ? undefined : { status: 400 },
      )
    },

    async action(context) {
      let token = context.params.token ?? ''
      let theme = await readTheme(context.request)
      let db = context.get(Database)
      let userId = await peekResetToken(db, token)

      let parsed = s.parseSafe(resetSchema, context.get(FormData))
      if (!parsed.success) {
        if (userId === null) {
          return context.render(
            <ResetPasswordPage token={token} invalid theme={theme} />,
            { status: 400 },
          )
        }
        return context.render(
          <ResetPasswordPage
            token={token}
            error="Password must be at least 6 characters."
            theme={theme}
          />,
          { status: 400 },
        )
      }

      let confirmedUserId = await consumeResetToken(db, token)
      if (confirmedUserId === null) {
        return context.render(
          <ResetPasswordPage token={token} invalid theme={theme} />,
          { status: 400 },
        )
      }

      await updatePassword(db, confirmedUserId, parsed.value.password)

      let session = context.get(Session)
      session.flash('notice', 'Your password was updated. Log in with your new password.')

      return redirect(routes.auth.login.index.href(), 303)
    },
  },
})
