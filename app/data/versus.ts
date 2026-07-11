import { Database } from "remix/data-table";
import { inList } from "remix/data-table/operators";

import { users, versusGames, type VersusGame } from "./schema.ts";

type Db = InstanceType<typeof Database>;

export interface NewVersusGame {
  winner_user_id: number | null;
  loser_user_id: number | null;
  winner_name: string;
  loser_name: string;
  seed: number;
  winner_actions: string;
  winner_garbage: string;
  winner_lines: number;
  loser_actions: string;
  loser_garbage: string;
  loser_lines: number;
}

export async function createVersusGame(db: Db, data: NewVersusGame): Promise<number> {
  let result = await db.create(versusGames, { ...data, created_at: Date.now() });
  return result.insertId as number;
}

export function getVersusGame(db: Db, id: number): Promise<VersusGame | null> {
  return db.find(versusGames, id);
}

export interface VersusStanding {
  rank: number;
  user_id: number;
  username: string;
  wins: number;
  games: number;
  // Win rate as a 0–100 integer percentage.
  winRate: number;
  // A representative match to watch — the user's most recent win if they have
  // one, otherwise their most recent game.
  replayGameId: number;
}

// Which column the standings are ranked by. 'avg' (win rate) is the default;
// 'wins' ranks by total wins.
export type VersusSort = "avg" | "wins";
export type VersusDir = "asc" | "desc";

// Aggregate every stored match into a per-registered-user standings table.
// Guests (null user ids) are not ranked. The chosen column uses the other as
// its tiebreak; 'asc' reverses the whole order.
export async function versusLeaderboard(
  db: Db,
  sort: VersusSort = "avg",
  dir: VersusDir = "desc",
  limit = 25,
): Promise<VersusStanding[]> {
  let games = await db.findMany(versusGames, { orderBy: ["created_at", "desc"] });

  interface Tally {
    user_id: number;
    wins: number;
    games: number;
    latestWinId: number | null;
    latestGameId: number;
  }
  let tallies = new Map<number, Tally>();

  // Rows are newest-first, so the first id seen for a user is their latest.
  for (let game of games) {
    if (game.winner_user_id != null) {
      let t = tallies.get(game.winner_user_id);
      if (!t) {
        t = {
          user_id: game.winner_user_id,
          wins: 0,
          games: 0,
          latestWinId: null,
          latestGameId: game.id,
        };
        tallies.set(game.winner_user_id, t);
      }
      t.wins++;
      t.games++;
      if (t.latestWinId == null) t.latestWinId = game.id;
    }
    if (game.loser_user_id != null) {
      let t = tallies.get(game.loser_user_id);
      if (!t) {
        t = {
          user_id: game.loser_user_id,
          wins: 0,
          games: 0,
          latestWinId: null,
          latestGameId: game.id,
        };
        tallies.set(game.loser_user_id, t);
      }
      t.games++;
    }
  }

  let ranked = [...tallies.values()]
    .sort((a, b) => {
      let aRate = a.games > 0 ? a.wins / a.games : 0;
      let bRate = b.games > 0 ? b.wins / b.games : 0;
      let order =
        sort === "wins" ? b.wins - a.wins || bRate - aRate : bRate - aRate || b.wins - a.wins;
      return dir === "asc" ? -order : order;
    })
    .slice(0, limit);
  if (ranked.length === 0) return [];

  let userRows = await db.findMany(users, {
    where: inList(
      "id",
      ranked.map((t) => t.user_id),
    ),
  });
  let names = new Map(userRows.map((u) => [u.id, u.username]));

  return ranked.map((t, i) => ({
    rank: i + 1,
    user_id: t.user_id,
    username: names.get(t.user_id) ?? "unknown",
    wins: t.wins,
    games: t.games,
    winRate: t.games > 0 ? Math.round((t.wins / t.games) * 100) : 0,
    replayGameId: t.latestWinId ?? t.latestGameId,
  }));
}
