import type { Database } from 'remix/data-table'
import type { Session } from 'remix/session'

import { createGame } from '../data/games.ts'

type Db = InstanceType<typeof Database>

// A finished anonymous run, parked in the (server-side) session until the
// player signs in. The result fields are already server-verified by the submit
// handler, so claiming it later does not need to re-run the simulation.
export interface PendingGame {
  mode: string
  seed: number
  lines_goal: number
  duration_ms: number
  lines_cleared: number
  // Recorded inputs as JSON, same encoding the games table uses.
  actions: string
}

const KEY = 'pendingGame'

export function storePendingGame(session: Session, pending: PendingGame): void {
  // Only the latest unsaved run is kept; a newer finish replaces it.
  session.set(KEY, pending)
}

export function readPendingGame(session: Session): PendingGame | null {
  return (session.get(KEY) as PendingGame | undefined) ?? null
}

// Persists the parked run under the now-authenticated user and clears it from
// the session. Returns the new game id, or null when nothing was pending.
export async function claimPendingGame(
  session: Session,
  db: Db,
  userId: number,
): Promise<number | null> {
  let pending = readPendingGame(session)
  if (!pending) return null
  let id = await createGame(db, { ...pending, user_id: userId })
  session.unset(KEY)
  return id
}
