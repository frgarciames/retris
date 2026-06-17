import { Database } from 'remix/data-table'
import { Auth } from 'remix/middleware/auth'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import {
  countGames,
  countUsers,
  deleteGame,
  deleteUserAndData,
  listGames,
  listUsers,
} from '../../data/admin.ts'
import { readTheme } from '../../middleware/theme.ts'
import { routes } from '../../routes.ts'
import { AdminPage, PAGE_SIZE } from '../../ui/admin-page.tsx'
import { isAdmin } from '../../utils/admin.ts'

// Everything under /admin is invisible to non-admins: 404, not 403, so the
// routes do not confirm they exist.
const notFound = () => new Response('Not Found', { status: 404 })

// Clamps an arbitrary query/form value to a valid 1-based page number.
function pageNumber(raw: unknown, total: number): number {
  let pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  let page = Number(raw)
  if (!Number.isInteger(page) || page < 1) return 1
  return Math.min(page, pages)
}

// Redirect target after a delete, restoring both tables' pagination.
function backToAdmin(form: FormData): Response {
  let params = new URLSearchParams()
  for (let key of ['users', 'games'] as const) {
    let page = Number(form.get(key))
    params.set(key, String(Number.isInteger(page) && page > 1 ? page : 1))
  }
  return redirect(`${routes.admin.index.href()}?${params}`, 303)
}

export default createController(routes.admin, {
  actions: {
    // GET /admin — both tables, independently paginated via ?users= & ?games=.
    async index(context) {
      let auth = context.get(Auth)
      if (!auth.ok || !isAdmin(auth.identity)) return notFound()
      let admin = auth.identity

      let db = context.get(Database)
      let [userTotal, gameTotal] = await Promise.all([countUsers(db), countGames(db)])
      let userPage = pageNumber(context.url.searchParams.get('users'), userTotal)
      let gamePage = pageNumber(context.url.searchParams.get('games'), gameTotal)

      let [userItems, gameItems] = await Promise.all([
        listUsers(db, PAGE_SIZE, (userPage - 1) * PAGE_SIZE),
        listGames(db, PAGE_SIZE, (gamePage - 1) * PAGE_SIZE),
      ])

      let theme = await readTheme(context.request)
      return context.render(
        <AdminPage
          user={{ username: admin.username }}
          theme={theme}
          selfId={admin.id}
          users={{
            items: userItems,
            page: userPage,
            pages: Math.max(1, Math.ceil(userTotal / PAGE_SIZE)),
            total: userTotal,
          }}
          games={{
            items: gameItems,
            page: gamePage,
            pages: Math.max(1, Math.ceil(gameTotal / PAGE_SIZE)),
            total: gameTotal,
          }}
        />,
      )
    },

    // POST /admin/users/:id/delete — remove a user and all of their games.
    async deleteUser(context) {
      let auth = context.get(Auth)
      if (!auth.ok || !isAdmin(auth.identity)) return notFound()

      let id = Number(context.params.id)
      if (!Number.isInteger(id)) return notFound()
      // The admin cannot delete itself; that would lock the view out entirely.
      if (id === auth.identity.id) {
        return new Response('Cannot delete the admin account.', { status: 400 })
      }

      await deleteUserAndData(context.get(Database), id)
      return backToAdmin(context.get(FormData))
    },

    // POST /admin/games/:id/delete — remove a single game.
    async deleteGame(context) {
      let auth = context.get(Auth)
      if (!auth.ok || !isAdmin(auth.identity)) return notFound()

      let id = Number(context.params.id)
      if (!Number.isInteger(id)) return notFound()

      await deleteGame(context.get(Database), id)
      return backToAdmin(context.get(FormData))
    },
  },
})
