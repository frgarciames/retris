import { Database } from 'remix/data-table'
import { inList } from 'remix/data-table/operators'

import { getMode, rankingKind } from '../game/modes.ts'
import { games, users, type Game } from './schema.ts'

type Db = InstanceType<typeof Database>

export interface ClassicScore {
  level: number
  duration_ms: number
}

export interface NewGame {
  user_id: number
  mode: string
  seed: number
  lines_goal: number
  duration_ms: number
  level: number
  lines_cleared: number
  actions: string
}

export function beatsClassicScore(candidate: ClassicScore, existing: ClassicScore): boolean {
  if (candidate.level !== existing.level) return candidate.level > existing.level
  return candidate.duration_ms > existing.duration_ms
}

export async function createGame(db: Db, data: NewGame): Promise<number> {
  let result = await db.create(games, { ...data, created_at: Date.now() })
  return result.insertId as number
}

export async function updateGame(
  db: Db,
  id: number,
  data: Omit<NewGame, 'user_id'>,
): Promise<void> {
  await db.update(games, id, { ...data, created_at: Date.now() })
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

export async function getUserBestForMode(
  db: Db,
  userId: number,
  mode: string,
): Promise<Game | null> {
  let modeDef = getMode(mode)
  if (modeDef && rankingKind(modeDef) === 'levelTime') {
    return db.findOne(games, {
      where: { user_id: userId, mode },
      orderBy: [
        ['level', 'desc'],
        ['duration_ms', 'desc'],
      ],
    })
  }
  return db.findOne(games, { where: { user_id: userId, mode } })
}

function compareClassicGames(a: Game, b: Game): number {
  if (a.level !== b.level) return b.level - a.level
  return b.duration_ms - a.duration_ms
}

async function classicBests(db: Db, mode: string): Promise<Game[]> {
  let runs = await db.findMany(games, {
    where: { mode },
    orderBy: [
      ['level', 'desc'],
      ['duration_ms', 'desc'],
    ],
  })

  let bestByUser = new Map<number, Game>()
  for (let run of runs) {
    let prev = bestByUser.get(run.user_id)
    if (!prev || beatsClassicScore(run, prev)) bestByUser.set(run.user_id, run)
  }
  return [...bestByUser.values()].sort(compareClassicGames)
}

export async function rankForClassicScore(
  db: Db,
  mode: string,
  score: ClassicScore,
): Promise<number> {
  let bests = await classicBests(db, mode)
  let better = bests.filter((game) => beatsClassicScore(game, score)).length
  return better + 1
}

export async function rankForClassicUser(db: Db, userId: number, mode: string): Promise<number | null> {
  let best = await getUserBestForMode(db, userId, mode)
  if (!best) return null
  return rankForClassicScore(db, mode, best)
}

export interface LeaderboardEntry {
  rank: number
  game: Game
  username: string
}

// Best completed run per user for a mode. Sprint: fastest time. Classic: highest
// level, then longest survival at that level.
export async function leaderboard(db: Db, mode: string, limit = 25): Promise<LeaderboardEntry[]> {
  let modeDef = getMode(mode)
  if (modeDef && rankingKind(modeDef) === 'levelTime') {
    let best = (await classicBests(db, mode)).slice(0, limit)
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

export async function saveClassicBestIfBetter(
  db: Db,
  userId: number,
  data: Omit<NewGame, 'user_id'>,
): Promise<{ saved: boolean; gameId: number | null }> {
  let score: ClassicScore = { level: data.level, duration_ms: data.duration_ms }
  let existing = await getUserBestForMode(db, userId, data.mode)
  if (existing && !beatsClassicScore(score, existing)) {
    return { saved: false, gameId: existing.id }
  }

  if (existing) {
    await updateGame(db, existing.id, data)
    return { saved: true, gameId: existing.id }
  }

  let id = await createGame(db, { ...data, user_id: userId })
  return { saved: true, gameId: id }
}
