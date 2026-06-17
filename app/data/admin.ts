import { Database } from 'remix/data-table'
import { inList } from 'remix/data-table/operators'

import { games, users, type Game, type User } from './schema.ts'

type Db = InstanceType<typeof Database>

export interface UserListItem {
  user: User
  gameCount: number
}

export interface GameListItem {
  game: Game
  username: string
}

export function countUsers(db: Db): Promise<number> {
  return db.count(users)
}

export function countGames(db: Db): Promise<number> {
  return db.count(games)
}

// Newest accounts first, with a per-row game count so the admin can see how
// much data a deletion would take with it.
export async function listUsers(db: Db, limit: number, offset: number): Promise<UserListItem[]> {
  let rows = await db.findMany(users, { orderBy: ['created_at', 'desc'], limit, offset })
  return Promise.all(
    rows.map(async (user) => ({
      user,
      gameCount: await db.count(games, { where: { user_id: user.id } }),
    })),
  )
}

// Newest games first, attributed to their owner's username.
export async function listGames(db: Db, limit: number, offset: number): Promise<GameListItem[]> {
  let rows = await db.findMany(games, { orderBy: ['created_at', 'desc'], limit, offset })
  if (rows.length === 0) return []

  let owners = await db.findMany(users, {
    where: inList('id', [...new Set(rows.map((g) => g.user_id))]),
  })
  let names = new Map(owners.map((u) => [u.id, u.username]))

  return rows.map((game) => ({ game, username: names.get(game.user_id) ?? 'unknown' }))
}

// Removes the user and every game they own. The games table has no ON DELETE
// CASCADE, so the cascade is done here, games first, to avoid orphan rows.
export async function deleteUserAndData(db: Db, userId: number): Promise<boolean> {
  await db.deleteMany(games, { where: { user_id: userId } })
  return db.delete(users, userId)
}

export function deleteGame(db: Db, gameId: number): Promise<boolean> {
  return db.delete(games, gameId)
}
