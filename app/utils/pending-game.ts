import type { Database } from "remix/data-table";
import type { Session } from "remix/session";

import { beatsClassicScore, createGame, saveClassicBestIfBetter } from "../data/games.ts";
import { getMode, rankingKind } from "../game/modes.ts";

type Db = InstanceType<typeof Database>;

// A finished anonymous run, parked in the (server-side) session until the
// player signs in. The result fields are already server-verified by the submit
// handler, so claiming it later does not need to re-run the simulation.
export interface PendingGame {
  mode: string;
  seed: number;
  lines_goal: number;
  duration_ms: number;
  level: number;
  lines_cleared: number;
  // Recorded inputs as JSON, same encoding the games table uses.
  actions: string;
}

const KEY = "pendingGame";

export function storePendingGame(session: Session, pending: PendingGame): void {
  // Only the latest unsaved run is kept; a newer finish replaces it.
  session.set(KEY, pending);
}

export function readPendingGame(session: Session): PendingGame | null {
  return (session.get(KEY) as PendingGame | undefined) ?? null;
}

// The session holds one pending run. Only replace it with a finish in the same
// mode (classic compares scores; sprint modes replace same-mode pending).
export function shouldReplacePendingForMode(pending: PendingGame | null, mode: string): boolean {
  if (!pending) return true;
  return pending.mode === mode;
}

export function shouldReplacePendingClassic(
  pending: PendingGame | null,
  candidate: { level: number; duration_ms: number },
): boolean {
  if (!pending) return true;
  if (pending.mode !== "classic") return false;
  return beatsClassicScore(candidate, pending);
}

// Persists the parked run under the now-authenticated user and clears it from
// the session. Returns the new game id, or null when nothing was pending.
export async function claimPendingGame(
  session: Session,
  db: Db,
  userId: number,
): Promise<number | null> {
  let pending = readPendingGame(session);
  if (!pending) return null;

  let mode = getMode(pending.mode);
  if (mode && rankingKind(mode) === "levelTime") {
    let { gameId } = await saveClassicBestIfBetter(db, userId, {
      mode: pending.mode,
      seed: pending.seed,
      lines_goal: pending.lines_goal,
      duration_ms: pending.duration_ms,
      level: pending.level,
      lines_cleared: pending.lines_cleared,
      actions: pending.actions,
    });
    session.unset(KEY);
    return gameId;
  }

  let id = await createGame(db, { ...pending, user_id: userId, level: pending.level ?? 0 });
  session.unset(KEY);
  return id;
}
