import { form, get, post, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  // The home page is the live game, playable without an account. Anonymous
  // runs are parked in the session until sign-in.
  home: '/',

  // Best-time-per-user leaderboards, one per mode.
  leaderboard: get('leaderboard'),

  // The signed-in user's own game history (solo runs + 1v1 matches). Private:
  // the handler redirects anyone who is not authenticated to log in.
  profile: get('profile'),

  // Sets the UI theme preference cookie, then redirects back.
  theme: post('theme'),

  // Crawler directives + sitemap, generated so the URLs match APP_URL.
  robots: get('robots.txt'),
  sitemap: get('sitemap.xml'),

  auth: route('auth', {
    login: form('login'), // GET /auth/login (index) + POST /auth/login (action)
    signup: form('signup'), // GET /auth/signup (index) + POST /auth/signup (action)
    logout: post('logout'), // POST /auth/logout
    forgotPassword: form('forgot-password'),
    resetPassword: form('reset-password/:token'),
  }),

  games: route('games', {
    submit: post('/'), // POST /games — submit a finished replay (auth checked in handler)
    show: get(':id'), // GET /games/:id — public replay viewer
  }),

  // Live 1v1 matches. The index page hosts the multiplayer board; `events` is a
  // long-lived SSE stream carrying matchmaking, reconnection, and opponent
  // updates; `update` is the client→server post that drives a match; `show`
  // plays back a stored match.
  versus: route('1vs1', {
    index: get('/'), // GET /1vs1 — the multiplayer page
    events: get('events'), // GET /1vs1/events — SSE stream (keyed by ?clientId)
    update: post('update'), // POST /1vs1/update — board snapshot / garbage / result
    show: get('games/:id'), // GET /1vs1/games/:id — versus replay viewer
  }),

  // Admin-only (single hardcoded account, see app/utils/admin.ts). Non-admins
  // get a 404 so the routes do not advertise their existence.
  admin: route('admin', {
    index: get('/'), // GET /admin — paginated users + games tables
    deleteUser: post('users/:id/delete'), // POST — remove a user and all their games
    deleteGame: post('games/:id/delete'), // POST — remove a single game
  }),
})
