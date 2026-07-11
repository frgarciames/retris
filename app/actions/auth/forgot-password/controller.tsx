import { Database } from 'remix/data-table'
import * as s from 'remix/data-schema'
import { email } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'
import { createController } from 'remix/router'

import { createResetToken } from '../../../data/password-reset.ts'
import { findByEmail } from '../../../data/users.ts'
import { readTheme } from '../../../middleware/theme.ts'
import { routes } from '../../../routes.ts'
import { ForgotPasswordPage } from '../../../ui/forgot-password-page.tsx'
import { sendPasswordResetEmail } from '../../../mail/index.ts'

let forgotSchema = f.object({
  email: f.field(s.string().pipe(email())),
})

export default createController(routes.auth.forgotPassword, {
  actions: {
    async index(context) {
      let theme = await readTheme(context.request)
      return context.render(<ForgotPasswordPage theme={theme} />)
    },

    async action(context) {
      let theme = await readTheme(context.request)
      let formData = context.get(FormData)
      let parsed = s.parseSafe(forgotSchema, formData)
      if (!parsed.success) {
        return context.render(
          <ForgotPasswordPage
            error="Enter a valid email address."
            email={String(formData.get('email') ?? '')}
            theme={theme}
          />,
          { status: 400 },
        )
      }

      let { email: address } = parsed.value
      let db = context.get(Database)
      let user = await findByEmail(db, address)
      if (user) {
        let token = await createResetToken(db, user.id)
        try {
          await sendPasswordResetEmail(address, token)
        } catch (error) {
          console.error('Failed to send password reset email:', error)
        }
      }

      return context.render(<ForgotPasswordPage sent theme={theme} />)
    },
  },
})
