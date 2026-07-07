import { Database } from 'remix/data-table'
import { Auth } from 'remix/middleware/auth'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { assetServer } from '../assets.ts'
import { leaderboard } from '../data/games.ts'
import { getUserGamesPage } from '../data/profile.ts'
import { versusLeaderboard, type VersusDir, type VersusSort } from '../data/versus.ts'
import { DEFAULT_MODE, isValidMode, singlePlayerModes } from '../game/modes.ts'
import { randomSeed } from '../game/rng.ts'
import { readTheme, themeCookie } from '../middleware/theme.ts'
import { routes } from '../routes.ts'
import { HomePage } from '../ui/home-page.tsx'
import { LeaderboardPage } from '../ui/leaderboard-page.tsx'
import { PAGE_SIZE, ProfilePage } from '../ui/profile-page.tsx'
import { siteUrl } from '../ui/seo.tsx'
import { DEFAULT_THEME, isValidTheme } from '../ui/themes.ts'

export default createController(routes, {
  actions: {
    async assets(context) {
      return (
        (await assetServer.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
      )
    },

    // GET / — the game itself, playable with or without an account.
    async home(context) {
      let auth = context.get(Auth)
      let user = auth.ok ? { username: auth.identity.username } : null
      let theme = await readTheme(context.request)

      // Mode is chosen via ?mode=; fall back to the default for unknown values
      // or the 1v1 mode, which has its own page.
      let modeParam = context.url.searchParams.get('mode')
      let soloModes = singlePlayerModes()
      let mode =
        modeParam && isValidMode(modeParam) && soloModes.some((m) => m.id === modeParam)
          ? modeParam
          : DEFAULT_MODE

      return context.render(
        <HomePage
          user={user}
          theme={theme}
          seed={randomSeed()}
          mode={mode}
          modes={singlePlayerModes()}
        />,
      )
    },

    // GET /leaderboard — best time per user, one board per registered mode so
    // new modes appear automatically.
    async leaderboard(context) {
      let db = context.get(Database)
      let boards = await Promise.all(
        singlePlayerModes().map(async (mode) => ({
          mode,
          entries: await leaderboard(db, mode.id),
        })),
      )
      // 1v1 standings sort by win rate by default; ?vsort=wins ranks by wins
      // and ?vdir=asc flips from the default descending order.
      let vsort: VersusSort = context.url.searchParams.get('vsort') === 'wins' ? 'wins' : 'avg'
      let vdir: VersusDir = context.url.searchParams.get('vdir') === 'asc' ? 'asc' : 'desc'
      let versus = await versusLeaderboard(db, vsort, vdir)
      let auth = context.get(Auth)
      let user = auth.ok ? { username: auth.identity.username } : null
      let theme = await readTheme(context.request)
      return context.render(
        <LeaderboardPage
          user={user}
          boards={boards}
          versus={versus}
          versusSort={vsort}
          versusDir={vdir}
          theme={theme}
        />,
      )
    },

    // GET /profile — the signed-in user's own game history. Private: anonymous
    // visitors are sent to log in and returned here once authenticated.
    async profile(context) {
      let auth = context.get(Auth)
      if (!auth.ok) {
        let returnTo = encodeURIComponent(routes.profile.href())
        return redirect(`${routes.auth.login.index.href()}?returnTo=${returnTo}`, 303)
      }

      let db = context.get(Database)
      let pageParam = Number(context.url.searchParams.get('page'))
      let page = Number.isInteger(pageParam) ? pageParam : 1
      let games = await getUserGamesPage(db, auth.identity.id, page, PAGE_SIZE)

      let theme = await readTheme(context.request)
      return context.render(
        <ProfilePage
          user={{ username: auth.identity.username, email: auth.identity.email }}
          theme={theme}
          games={games}
        />,
      )
    },

    // GET /robots.txt — let crawlers index public pages, keep private ones out,
    // and point them at the sitemap.
    async robots() {
      let body = [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /profile',
        'Disallow: /auth/',
        '',
        `Sitemap: ${siteUrl(routes.sitemap.href())}`,
        '',
      ].join('\n')
      return new Response(body, {
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'public, max-age=3600',
        },
      })
    },

    // GET /sitemap.xml — the public, indexable entry points.
    async sitemap() {
      let urls = [routes.home.href(), routes.leaderboard.href(), routes.versus.index.href()]
      let body =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        urls.map((u) => `  <url><loc>${siteUrl(u)}</loc></url>`).join('\n') +
        '\n</urlset>\n'
      return new Response(body, {
        headers: {
          'content-type': 'application/xml; charset=utf-8',
          'cache-control': 'public, max-age=3600',
        },
      })
    },

    // POST /theme — persist the chosen theme. The client-side switcher calls
    // this via fetch (accept: application/json) and only needs the cookie; the
    // no-JS form fallback gets a redirect back to the page it was on (the
    // Referer), defaulting to home.
    async theme(context) {
      let id = String(context.get(FormData).get('theme') ?? '')
      if (!isValidTheme(id)) id = DEFAULT_THEME

      if (context.request.headers.get('accept')?.includes('application/json')) {
        return new Response(null, {
          status: 204,
          headers: { 'set-cookie': await themeCookie.serialize(id) },
        })
      }

      let back = '/'
      let referer = context.request.headers.get('referer')
      if (referer) {
        try {
          let url = new URL(referer)
          if (url.origin === context.url.origin) back = url.pathname + url.search
        } catch {
          // ignore an unparseable Referer and fall back to home
        }
      }

      return new Response(null, {
        status: 303,
        headers: { location: back, 'set-cookie': await themeCookie.serialize(id) },
      })
    },

  },
})
