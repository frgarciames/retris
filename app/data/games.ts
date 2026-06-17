import { Database } from 'remix/data-table'
import { inList } from 'remix/data-table/operators'

import { games, users, type Game } from './schema.ts'

type Db = InstanceType<typeof Database>

export interface NewGame {
  user_id: number
  mode: string
  seed: number
  lines_goal: number
  duration_ms: number
  lines_cleared: number
  actions: string
}

export async function createGame(db: Db, data: NewGame): Promise<number> {
  let result = await db.create(games, { ...data, created_at: Date.now() })
  return result.insertId as number
}

export function getGame(db: Db, id: number): Promise<Game | null> {
  return db.find(games, id)
}

export async function getGameWithUsername(
  db: Db,
  id: number,
): Promise<{ game: Game; username: string } | null> {
  let game = await db.find(games, id)
  if (!game) return null
  let user = await db.find(users, game.user_id)
  return { game, username: user?.username ?? 'unknown' }
}

export interface LeaderboardEntry {
  rank: number
  game: Game
  username: string
}

// Best (fastest) completed run per user for a mode, ranked ascending. Runs are
// already ordered by duration, so the first run seen for each user is their best.
export async function leaderboard(db: Db, mode: string, limit = 25): Promise<LeaderboardEntry[]> {
  let runs = await db.findMany(games, { where: { mode }, orderBy: ['duration_ms', 'asc'] })

  let bestByUser = new Map<number, Game>()
  for (let run of runs) {
    if (!bestByUser.has(run.user_id)) bestByUser.set(run.user_id, run)
  }
  let best = [...bestByUser.values()].slice(0, limit)
  if (best.length === 0) return []

  let userRows = await db.findMany(users, {
    where: inList('id', best.map((g) => g.user_id)),
  })
  let names = new Map(userRows.map((u) => [u.id, u.username]))

  return best.map((game, i) => ({
    rank: i + 1,
    game,
    username: names.get(game.user_id) ?? 'unknown',
  }))
}
