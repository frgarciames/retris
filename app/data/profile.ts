import { Database, sql } from "remix/data-table";

type Db = InstanceType<typeof Database>;

// One row in a profile's game history. Solo runs and 1v1 matches are merged into
// a single list; `kind` selects which replay route the UI links to and `modeId`
// is resolved to a human label via the mode registry.
export interface ProfileGame {
  kind: "solo" | "versus";
  id: number;
  // A solo mode id ("sprint20") or "versus" for 1v1.
  modeId: string;
  created_at: number;
  // 1v1 only: whether the profile owner won the match.
  won?: boolean;
}

export interface ProfileGamesPage {
  items: ProfileGame[];
  page: number;
  pages: number;
  total: number;
}

// Total games a user owns across both tables. Used to bound pagination before
// the page query runs.
async function countUserGames(db: Db, userId: number): Promise<number> {
  // The `sql` tag is load-bearing: it turns every ${} into a bound `?`
  // parameter. Without it this would be a plain template literal — string
  // concatenation — and the interpolated values would be open to SQL injection.
  let { rows } = await db.exec(sql`
    SELECT
      (SELECT COUNT(*) FROM games WHERE user_id = ${userId})
      + (SELECT COUNT(*) FROM versus_games
         WHERE winner_user_id = ${userId} OR loser_user_id = ${userId})
      AS total
  `);
  return Number(rows?.[0]?.total ?? 0);
}

// Every game a user owns — solo runs plus 1v1 matches they played on either
// side — newest first. The two tables are combined with UNION ALL and the page
// window (ORDER BY / LIMIT / OFFSET) is applied by the database, so only one
// page of rows is ever materialized.
export async function getUserGamesPage(
  db: Db,
  userId: number,
  page: number,
  pageSize: number,
): Promise<ProfileGamesPage> {
  let total = await countUserGames(db, userId);
  let pages = Math.max(1, Math.ceil(total / pageSize));
  let current = Math.min(Math.max(1, page), pages);
  let offset = (current - 1) * pageSize;

  // `sql` tag required — see countUserGames: it parameterizes the ${} values
  // (bound `?`), so dropping it would reintroduce SQL injection.
  let { rows } = await db.exec(sql`
    SELECT id, 'solo' AS kind, mode AS mode_id, created_at, NULL AS won
    FROM games
    WHERE user_id = ${userId}
    UNION ALL
    SELECT id, 'versus' AS kind, 'versus' AS mode_id, created_at,
           CASE WHEN winner_user_id = ${userId} THEN 1 ELSE 0 END AS won
    FROM versus_games
    WHERE winner_user_id = ${userId} OR loser_user_id = ${userId}
    ORDER BY created_at DESC, kind ASC, id DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `);

  let items: ProfileGame[] = (rows ?? []).map((r) => ({
    kind: r.kind as "solo" | "versus",
    id: Number(r.id),
    modeId: String(r.mode_id),
    created_at: Number(r.created_at),
    won: r.kind === "versus" ? Boolean(r.won) : undefined,
  }));

  return { items, page: current, pages, total };
}
