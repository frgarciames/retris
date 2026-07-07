import { formData } from 'remix/middleware/form-data'
import { session } from 'remix/middleware/session'
import { staticFiles } from 'remix/middleware/static'
import { createRouter, type RouterContext } from 'remix/router'

import adminController from './actions/admin/controller.tsx'
import authController from './actions/auth/controller.tsx'
import authLoginController from './actions/auth/login/controller.tsx'
import authSignupController from './actions/auth/signup/controller.tsx'
import authForgotPasswordController from './actions/auth/forgot-password/controller.tsx'
import authResetPasswordController from './actions/auth/reset-password/controller.tsx'
import rootController from './actions/controller.tsx'
import gamesController from './actions/games/controller.tsx'
import versusController from './actions/versus/controller.tsx'
import { loadAuth } from './middleware/auth.ts'
import { loadDatabase } from './middleware/database.ts'
import { render } from './middleware/render.tsx'
import { sessionCookie, sessionStorage } from './middleware/session.ts'
import { routes } from './routes.ts'

export const router = createRouter({
  middleware: [
    staticFiles('./public', { index: false }),
    render(),
    formData(),
    session(sessionCookie, sessionStorage),
    loadDatabase(),
    loadAuth(),
  ],
})

export type AppContext = RouterContext<typeof router>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

router.map(routes, rootController)
router.map(routes.auth, authController)
router.map(routes.auth.login, authLoginController)
router.map(routes.auth.signup, authSignupController)
router.map(routes.auth.forgotPassword, authForgotPasswordController)
router.map(routes.auth.resetPassword, authResetPasswordController)
router.map(routes.games, gamesController)
router.map(routes.versus, versusController)
router.map(routes.admin, adminController)
